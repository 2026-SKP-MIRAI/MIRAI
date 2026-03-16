from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemini-2.5-flash"

    class Config:
        env_file = ".env"

settings = Settings()
