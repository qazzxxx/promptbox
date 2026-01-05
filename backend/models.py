from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON

class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    color: str = Field(default="blue") # For UI badges
    icon: Optional[str] = Field(default=None) # Icon name
    sort_order: int = Field(default=0)
    
    projects: List["Project"] = Relationship(back_populates="category")

class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: Optional[str] = None
    tags: List[str] = Field(default=[], sa_column=Column(JSON))
    category_id: Optional[int] = Field(default=None, foreign_key="category.id")
    is_favorite: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    category: Optional[Category] = Relationship(back_populates="projects")
    versions: List["Version"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete"})
    
    # New fields for Roadmap
    type: str = Field(default="text") # text, image

class Version(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    version_num: int
    content: str # Positive Prompt for image
    negative_prompt: Optional[str] = None # For image generation
    parameters: dict = Field(default={}, sa_column=Column(JSON)) # Seed, steps, etc.
    changelog: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    project: Optional[Project] = Relationship(back_populates="versions")

class AppSettings(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    openai_api_key: Optional[str] = None
    openai_base_url: str = Field(default="https://api.openai.com/v1")
    openai_model: str = Field(default="gpt-3.5-turbo")
    available_models: List[str] = Field(default=["gpt-3.5-turbo", "gpt-4", "dall-e-3"], sa_column=Column(JSON))
    
    # We can add more fields later (e.g. for other providers)
    provider: str = Field(default="openai") # openai, azure, anthropic, etc.
    
    # System Prompts
    optimize_prompt_template: str = Field(default="""你是一个专业的提示词工程师 (Prompt Engineer)。
你的任务是优化用户提供的 Prompt，使其更加清晰、结构化，并能引导 AI 生成更高质量的结果。
请保持原意不变，但进行以下改进：
1. 明确角色设定 (Role)
2. 补充背景信息 (Context)
3. 细化任务描述 (Task)
4. 规定输出格式 (Format)

请直接输出优化后的 Prompt 内容，不要包含解释性文字。""")
