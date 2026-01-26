# PROJECT
Agentic Git Assistance (Pacer)
UCL AgentVerse Hackathon

# PROJECT DETAILS
## Date
Oct 2025

## Summary
Built a prototype git-aware multi-agent system to help developers organise work and actively avoid merge conflicts.

## Details
The agent comes into effect once the features/user stories for a sprint have been agreed. The agent:
- Breaks user stories down into expected tasks.
- Proposes delegation of tasks to developers based on their skills profile and history in the repository.
- Prepares branches for the new features in the repository and assigns branches to developers.
- Notifies developers of updates over Slack.
- Prepares a commit plan based on agreed tasks.
- Monitors local repo live to suggest commits and pre-warn of potential conflicts.

The goal was to minmise the frustration of merge conflicts - especially those that could be avoided with simple fixes, and better planning. We developed an MVP that was a little rough around the edges, but captured the main features.

# PROJECT TECH STACK
- Python
- LangGraph
- Slack

# INTERESTING COMPONENTS
## Agentic tool use and integrations
- Many agents in this system performed tool calls to APIs: Slack, GitHub, Bash
- Managing / setting up these integrations was tedious but unlocked powerful agentic potential - as agents were given better access to useful data and able to interact conveniently.

## Multi-agent Framework:
- Building in LangGraph provided great learning experience.

# OUTCOMES
- Developed MVP multi-agent solution with working integrations
- 1st place in narrative track of competition
- Use case was found to be very interesting to developers, but less engaging to non-technical people
- Brandon gained increased humility (did not win)