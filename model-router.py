#!/usr/bin/env python3
"""
Verdict Model Router - Auto-select best model per task

Based on Elite 8-case benchmark results:
- phi4-14b: Default (won 5/8, 62.5%)
- qwen2.5-coder-14b: ML/data specialist (won 2/8)
- qwen3-coder-30b: Never use (worst performer)
"""

import re
from typing import Dict, List, Tuple
from dataclasses import dataclass
from enum import Enum


class ModelType(Enum):
    """Model categories"""
    GENERALIST = "generalist"
    ML_SPECIALIST = "ml_specialist"
    DATA_SPECIALIST = "data_specialist"
    NEVER_USE = "never_use"


@dataclass
class ModelConfig:
    """Model configuration"""
    id: str
    name: str
    provider: str
    model_type: ModelType
    speed_ms: int
    score: float
    strengths: List[str]
    weaknesses: List[str]
    

class ModelRouter:
    """
    Intelligent model router based on task analysis.
    
    Routes tasks to optimal model based on:
    - Task keywords/patterns
    - Performance data from benchmarks
    - Speed/quality trade-offs
    """
    
    def __init__(self):
        # Model definitions (from benchmark data)
        self.models = {
            "phi4-14b": ModelConfig(
                id="phi4-14b",
                name="Phi-4 14B",
                provider="ollama",
                model_type=ModelType.GENERALIST,
                speed_ms=28500,
                score=7.8,
                strengths=[
                    "distributed systems",
                    "event sourcing",
                    "async operations",
                    "data pipelines",
                    "metrics/monitoring",
                    "general architecture",
                    "clean code (9.0 conciseness)"
                ],
                weaknesses=[
                    "oauth2 protocols",
                    "ml-specific patterns"
                ]
            ),
            "qwen2.5-coder-14b": ModelConfig(
                id="qwen2.5-coder-14b",
                name="Qwen 2.5 Coder 14B",
                provider="ollama",
                model_type=ModelType.ML_SPECIALIST,
                speed_ms=31800,
                score=7.28,
                strengths=[
                    "ml inference",
                    "database migrations",
                    "data science",
                    "model serving"
                ],
                weaknesses=[
                    "general systems design",
                    "distributed systems",
                    "event sourcing"
                ]
            ),
            "qwen3-coder-30b": ModelConfig(
                id="qwen3-coder-30b",
                name="Qwen 3 Coder 30B",
                provider="ollama",
                model_type=ModelType.NEVER_USE,
                speed_ms=33300,
                score=7.47,
                strengths=[
                    "oauth2 (barely)"
                ],
                weaknesses=[
                    "slower than 14B",
                    "fewer wins than 14B",
                    "3x memory usage",
                    "zero advantages"
                ]
            )
        }
        
        # Task pattern definitions (from benchmark results)
        self.ml_patterns = [
            r'\bml\b',
            r'machine learning',
            r'model.*inference',
            r'model.*serving',
            r'prediction',
            r'fastapi.*model',
            r'onnx',
            r'pytorch',
            r'tensorflow',
            r'scikit',
            r'batch.*prediction'
        ]
        
        self.migration_patterns = [
            r'database.*migration',
            r'db.*migration',
            r'alembic',
            r'flyway',
            r'schema.*change',
            r'version.*control.*database',
            r'upgrade.*downgrade'
        ]
        
        self.data_patterns = [
            r'data.*pipeline',
            r'data.*processing',
            r'etl',
            r'streaming.*data',
            r'pandas',
            r'parquet',
            r'csv.*process'
        ]
        
    def route(self, task_description: str) -> Tuple[ModelConfig, str]:
        """
        Route task to optimal model.
        
        Args:
            task_description: Description of the coding task
            
        Returns:
            (selected_model, reasoning)
        """
        task_lower = task_description.lower()
        
        # Check ML patterns (qwen2.5-coder won 8.2 on ML inference)
        if self._matches_patterns(task_lower, self.ml_patterns):
            model = self.models["qwen2.5-coder-14b"]
            reasoning = (
                f"ML task detected → {model.name}\n"
                f"Benchmark: 8.2/10 on ML inference (beat phi4's 7.8)\n"
                f"Strengths: {', '.join(model.strengths[:3])}"
            )
            return model, reasoning
        
        # Check migration patterns (qwen2.5-coder won 8.2 on migrations)
        if self._matches_patterns(task_lower, self.migration_patterns):
            model = self.models["qwen2.5-coder-14b"]
            reasoning = (
                f"Database migration task → {model.name}\n"
                f"Benchmark: 8.2/10 on DB migrations (beat phi4's 7.8)\n"
                f"Strengths: {', '.join(model.strengths[:3])}"
            )
            return model, reasoning
        
        # Check data pipeline (phi4 won 7.8, but close call)
        if self._matches_patterns(task_lower, self.data_patterns):
            # phi4 still better on general data pipelines
            model = self.models["phi4-14b"]
            reasoning = (
                f"Data pipeline task → {model.name}\n"
                f"Benchmark: 7.8/10 on data pipeline (won vs 6.8)\n"
                f"Note: Use qwen2.5-coder if ML-heavy"
            )
            return model, reasoning
        
        # Default: phi4-14b (won 5/8 cases, 62.5%)
        model = self.models["phi4-14b"]
        reasoning = (
            f"General task → {model.name} (default)\n"
            f"Benchmark: 7.8/10 overall, 62.5% win rate (5/8 cases)\n"
            f"Won: distributed queue, data pipeline, async scraper, "
            f"metrics, event sourcing\n"
            f"Fastest: 28.5s (11% faster than qwen2.5-coder)"
        )
        return model, reasoning
    
    def _matches_patterns(self, text: str, patterns: List[str]) -> bool:
        """Check if text matches any pattern"""
        return any(re.search(pattern, text, re.IGNORECASE) for pattern in patterns)
    
    def explain_model(self, model_id: str) -> str:
        """Get detailed explanation of a model's capabilities"""
        if model_id not in self.models:
            return f"Unknown model: {model_id}"
        
        model = self.models[model_id]
        
        return f"""
{model.name} ({model.id})
{"="*50}

Type: {model.model_type.value}
Score: {model.score}/10
Speed: {model.speed_ms/1000:.1f}s per task

Strengths:
{chr(10).join(f"  ✓ {s}" for s in model.strengths)}

Weaknesses:
{chr(10).join(f"  ✗ {w}" for w in model.weaknesses)}

Provider: {model.provider}
        """.strip()
    
    def compare_models(self, task: str) -> str:
        """Compare all models for a given task"""
        selected, reasoning = self.route(task)
        
        output = [
            f"Task: {task}",
            f"{'='*60}",
            f"",
            f"RECOMMENDED: {selected.name}",
            f"{reasoning}",
            f"",
            f"{'='*60}",
            f"",
            f"COMPARISON:",
            f""
        ]
        
        # Sort by score
        sorted_models = sorted(
            self.models.values(),
            key=lambda m: m.score,
            reverse=True
        )
        
        for model in sorted_models:
            marker = "→" if model.id == selected.id else " "
            status = "✅ RECOMMENDED" if model.id == selected.id else ""
            if model.model_type == ModelType.NEVER_USE:
                status = "❌ NEVER USE"
            
            output.append(
                f"{marker} {model.name}: {model.score}/10, "
                f"{model.speed_ms/1000:.1f}s {status}"
            )
        
        return "\n".join(output)


def main():
    """CLI interface for model router"""
    import sys
    
    router = ModelRouter()
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python model-router.py <task_description>")
        print("  python model-router.py explain <model_id>")
        print("  python model-router.py compare <task_description>")
        print()
        print("Examples:")
        print('  python model-router.py "Build ML inference server"')
        print('  python model-router.py "Design event sourcing system"')
        print('  python model-router.py explain phi4-14b')
        print('  python model-router.py compare "Database migrations"')
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "explain":
        if len(sys.argv) < 3:
            print("Available models:")
            for model_id in router.models.keys():
                print(f"  - {model_id}")
            sys.exit(1)
        print(router.explain_model(sys.argv[2]))
    
    elif command == "compare":
        task = " ".join(sys.argv[2:])
        print(router.compare_models(task))
    
    else:
        task = " ".join(sys.argv[1:])
        model, reasoning = router.route(task)
        
        print(f"Task: {task}")
        print(f"{'='*60}")
        print()
        print(f"Selected Model: {model.name}")
        print(f"{'='*60}")
        print(reasoning)
        print()
        print(f"Speed: {model.speed_ms/1000:.1f}s")
        print(f"Quality: {model.score}/10")


if __name__ == "__main__":
    main()
