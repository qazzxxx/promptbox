import os
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from contextlib import asynccontextmanager
from models import Project, Version, Category, AppSettings
from openai import OpenAI

# Database Setup
if os.path.exists("/data"):
    sqlite_file_name = "/data/promptbox.db"
else:
    sqlite_file_name = "promptbox.db"

sqlite_url = f"sqlite:///{sqlite_file_name}"
connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    # Seed default categories if empty
    with Session(engine) as session:
        if not session.exec(select(Category)).first():
            default_cats = [
                Category(name="创意写作", color="magenta", sort_order=1),
                Category(name="代码助手", color="blue", sort_order=2),
                Category(name="数据分析", color="cyan", sort_order=3),
                Category(name="图像生成", color="purple", sort_order=4),
                Category(name="通用", color="gold", sort_order=5)
            ]
            for c in default_cats:
                session.add(c)
            session.commit()
            
        # Ensure Settings exist
        if not session.get(AppSettings, 1):
            session.add(AppSettings(id=1))
            session.commit()

def get_session():
    with Session(engine) as session:
        yield session

# Lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(lifespan=lifespan)

# --- Category Routes ---
@app.get("/api/categories", response_model=List[Category])
def read_categories(session: Session = Depends(get_session)):
    return session.exec(select(Category).order_by(Category.sort_order)).all()

class CategoryReorderItem(BaseModel):
    id: int
    sort_order: int

@app.put("/api/categories/reorder")
def reorder_categories(items: List[CategoryReorderItem], session: Session = Depends(get_session)):
    for item in items:
        cat = session.get(Category, item.id)
        if cat:
            cat.sort_order = item.sort_order
            session.add(cat)
    session.commit()
    return {"ok": True}

@app.post("/api/categories", response_model=Category)
def create_category(category: Category, session: Session = Depends(get_session)):
    # Calculate max sort_order
    max_order = session.exec(select(func.max(Category.sort_order))).first() or 0
    category.sort_order = max_order + 1
    session.add(category)
    session.commit()
    session.refresh(category)
    return category

@app.put("/api/categories/{category_id}", response_model=Category)
def update_category(category_id: int, category_data: Category, session: Session = Depends(get_session)):
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")
    category.name = category_data.name
    category.color = category_data.color
    category.icon = category_data.icon
    session.add(category)
    session.commit()
    session.refresh(category)
    return category

@app.delete("/api/categories/{category_id}")
def delete_category(category_id: int, session: Session = Depends(get_session)):
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")
    # Set projects in this category to None
    projects = session.exec(select(Project).where(Project.category_id == category_id)).all()
    for p in projects:
        p.category_id = None
        session.add(p)
    session.delete(category)
    session.commit()
    return {"ok": True}

# --- Project Routes ---
@app.post("/api/projects", response_model=Project)
def create_project(project: Project, session: Session = Depends(get_session)):
    project.updated_at = datetime.utcnow()
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

@app.get("/api/projects", response_model=List[Project])
def read_projects(
    category_id: Optional[int] = None, 
    search: Optional[str] = None, 
    is_favorite: Optional[bool] = None,
    session: Session = Depends(get_session)
):
    query = select(Project).order_by(Project.updated_at.desc())
    if category_id:
        query = query.where(Project.category_id == category_id)
    if is_favorite is not None:
        query = query.where(Project.is_favorite == is_favorite)
    if search:
        query = query.where(Project.name.contains(search) | Project.description.contains(search))
    
    projects = session.exec(query).all()
    return projects

@app.get("/api/projects/{project_id}", response_model=Project)
def read_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project

@app.put("/api/projects/{project_id}", response_model=Project)
def update_project(project_id: int, project_data: Project, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    project.name = project_data.name
    project.description = project_data.description
    project.tags = project_data.tags
    project.category_id = project_data.category_id
    project.updated_at = datetime.utcnow()
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

@app.post("/api/projects/{project_id}/favorite", response_model=Project)
def toggle_favorite(project_id: int, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    project.is_favorite = not project.is_favorite
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    session.delete(project)
    session.commit()
    return {"ok": True}

# --- Version Routes ---
@app.post("/api/projects/{project_id}/versions", response_model=Version)
def create_version(project_id: int, version: Version, session: Session = Depends(get_session)):
    # Check project exists
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    version.project_id = project_id
    # Calculate next version number
    existing_versions = session.exec(select(Version).where(Version.project_id == project_id)).all()
    version.version_num = len(existing_versions) + 1
    
    session.add(version)
    
    # Update project timestamp
    project.updated_at = datetime.utcnow()
    session.add(project)
    
    session.commit()
    session.refresh(version)
    return version

@app.get("/api/projects/{project_id}/versions", response_model=List[Version])
def read_versions(project_id: int, session: Session = Depends(get_session)):
    versions = session.exec(select(Version).where(Version.project_id == project_id).order_by(Version.version_num.desc())).all()
    return versions

# --- Settings Routes ---
@app.get("/api/settings", response_model=AppSettings)
def read_settings(session: Session = Depends(get_session)):
    settings = session.get(AppSettings, 1)
    if not settings:
        # Should create if missing (though seeded at startup)
        settings = AppSettings(id=1)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings

@app.put("/api/settings", response_model=AppSettings)
def update_settings(settings_data: AppSettings, session: Session = Depends(get_session)):
    settings = session.get(AppSettings, 1)
    if not settings:
        settings = AppSettings(id=1)
    
    settings.openai_api_key = settings_data.openai_api_key
    settings.openai_base_url = settings_data.openai_base_url
    settings.openai_model = settings_data.openai_model
    settings.available_models = settings_data.available_models
    settings.provider = settings_data.provider
    settings.optimize_prompt_template = settings_data.optimize_prompt_template
    
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings

# --- AI Routes ---
class OptimizeRequest(BaseModel):
    prompt: str

class OptimizeResponse(BaseModel):
    optimized_prompt: str

class RunRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = None
    parameters: dict = {}
    type: str = "text" # text, image
    model: Optional[str] = None # Override default model

class RunResponse(BaseModel):
    result: str # Text content or Image URL

@app.post("/api/ai/run", response_model=RunResponse)
def run_ai(request: RunRequest, session: Session = Depends(get_session)):
    settings = session.get(AppSettings, 1)
    if not settings or not settings.openai_api_key:
        raise HTTPException(status_code=400, detail="请先在设置中配置 API Key")
    
    try:
        client = OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            timeout=60.0
        )

        if request.type == "text":
            messages = [{"role": "user", "content": request.prompt}]
            
            # Extract common parameters
            temperature = float(request.parameters.get("temperature", 0.7))
            max_tokens = int(request.parameters.get("max_tokens", 2000))
            
            # Use requested model or default
            model_to_use = request.model or settings.openai_model

            response = client.chat.completions.create(
                model=model_to_use,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return RunResponse(result=response.choices[0].message.content)
            
        elif request.type == "image":
            # For image, we try to use OpenAI Image API (DALL-E)
            # This is a basic implementation.
            model_to_use = request.model or "dall-e-3"
            
            response = client.images.generate(
                model=model_to_use,
                prompt=request.prompt,
                size="1024x1024",
                quality="standard",
                n=1,
            )
            return RunResponse(result=response.data[0].url)
            
        else:
             raise HTTPException(status_code=400, detail="不支持的任务类型")

    except Exception as e:
        print(f"AI Run Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"执行失败: {str(e)}")

@app.post("/api/ai/optimize", response_model=OptimizeResponse)
def optimize_prompt(request: OptimizeRequest, session: Session = Depends(get_session)):
    settings = session.get(AppSettings, 1)
    
    if not settings or not settings.openai_api_key:
        raise HTTPException(status_code=400, detail="请先在设置中配置 API Key")
    
    try:
        client = OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            timeout=50.0 # Set timeout to 50 seconds
        )
        
        system_prompt = settings.optimize_prompt_template or """你是一个专业的提示词工程师 (Prompt Engineer)。
你的任务是优化用户提供的 Prompt，使其更加清晰、结构化，并能引导 AI 生成更高质量的结果。
请保持原意不变，但进行以下改进：
1. 明确角色设定 (Role)
2. 补充背景信息 (Context)
3. 细化任务描述 (Task)
4. 规定输出格式 (Format)

请直接输出优化后的 Prompt 内容，不要包含解释性文字。"""

        # Use async compatible run or wrap in thread if library is sync only, 
        # but standard OpenAI client is sync. FastAPI handles sync routes in threads.
        # However, for better performance or if it blocks too long, we might want async client.
        # For now, let's keep it sync but ensure it's defined as `def` not `async def` 
        # if we are using the sync client to avoid blocking the event loop incorrectly if mixed.
        # Wait, I see I defined it as `def` in the previous step, which is correct for sync calls in FastAPI.
        # But if the user reports failure, maybe it's a timeout? 
        # OpenAI calls can be slow.
        
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.prompt}
            ],
            temperature=0.7,
        )
        
        optimized_content = response.choices[0].message.content
        return OptimizeResponse(optimized_prompt=optimized_content)
        
    except Exception as e:
        # Log the full error for debugging
        print(f"AI Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI 调用失败: {str(e)}")

# SPA Static Files Hosting
static_dir = os.path.join(os.path.dirname(__file__), "static")

# Mount assets if they exist (Vite build produces 'assets' folder)
assets_dir = os.path.join(static_dir, "assets")
if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API 接口不存在")

    file_path = os.path.join(static_dir, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    
    # Fallback to index.html for SPA routing
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    
    return {"message": "前端未部署。请构建前端并将 dist 复制到 backend/static。"}
