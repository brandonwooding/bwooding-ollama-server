# PROJECT
Multi-Agent Observability Platform (Tracer)
Holistic AI Great Agent Hack

# PROJECT DETAILS
## Date
Nov 2025

## Summary
Built a general purpose multi-agent system, optimised for reliability and efficiency. Then built an observability platform around this system that visually mapped the agent runtime actions, and allowed users to query it in natural language.

## Details

- Generic, representative multi-agent solution was a vacation planner - utilised multiple tools for comparing flights, getting activities and preparing agenda within user specifications of location, dates and budget. Developed in LangChain.
- Hallucination prevention mechanism using semantic entropy calculations to identify potential points of risk, and using LLM as judge to validate information.
- Model router to efficient select best model for each agent based on agent task and requirements as well as user's system preferences in terms of speed, costs and sustainability. The router would err towards smaller models for cost and sustainability gains, especially when agents do not have complex responsibilities.
- Built visual agent runtime map using trace data from LangSmith. Sequence, reasoning and actions taken displayed.
- Built RAG-query system for trace data. Power-users could ask an LLM about different action in the trace to surface the reasoning / better understand the run.

# PROJECT TECH STACK
- Python
- LangChain
- LangSmith

# INTERESTING COMPONENTS
## Agent Observability
- The observability solution could be applied to any multi-agent system to help developers visualise traces debug with natural language queries

## Hallucination Reduction
- Implemented a recent paper (Hallucination Detection on a Budget: Efficient Bayesian Estimation of Semantic Entropy, Kamil Ciosek, Nicolò Felicioni, Sina Ghiassian, Sep 2025) to mathematically estimate points of hallucination risk

## Model Router
- Model routers exist for many Generative AI use cases, but Agentic AI has different considerations. It is even more critical for agents to use models that balance cost efficiency, latency and model performance as they can easily bloat token usage or break down with tool-call errors.

# OUTCOMES
- Did not sleep 
- Developed functional solution and delivered high-quality demo
- One of few teams to develop a solution that competed in all 3 tracks in the hackathon
- Brandon gained increased humility (did not win)