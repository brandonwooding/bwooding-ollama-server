# PROJECT
Wordle Multi-Agent Bot
Personal Project

# PROJECT DETAILS
## Date
Jan 2026 (last updated)

## Summary
Developed a multi-agent workflow to play the game Wordle online, using Google Agent Development Kit. The agent has persistent memory to refine its strategy over time.

## Details
The system consists of 4 main agents:
- Strategy Agent: thinks and decides on which word to play based on available information, and its reasoned strategy.
- Browser Agent: interacts with the browser (using selenium) to play word.
- Validation Agent: checks if word has submitted correct, or if game is finished.
- Interaction Agent: conversational agent to interface with human.

There are sub-system agents that help support the improvement of the system:
- Word History Scraper: fetches the history of words that have already been used in Wordle (these do no repeat)
- Orchestration agents: part of the Google ADK system that help manage the workflow.

On a given run, the system loops between the strategy agent and the browser agent. The strategy agent suggests a word. The browser agent plays that words and feeds back to the strategy agent the outcome.

# PROJECT TECH STACK
- Python
- Google Agent Development Kit (ADK)
- Selenium Web Module

# INTERESTING COMPONENTS
## Multi-agent Orchestration:
- This system has a pre-determined workflow which simplifies the project
- The decomposition of tasks had to be carefully considered
- Constraints had to be put in place to make sure the system does not get stuck in loops or exhaust unnecessary tokens.

## Memory management:
- short-term memory: within a game, the agent will remember each of its plays and the results from that play
- long-term memory: the agent writes strategy notes that it will refine over time.

## Tool use:
- Building agent tools within Google Agent Development Kit
- Understanding when to use an LLM agent with tools, vs when to use rules based process automation.

## Web scraping:
- Interacting with websites via selenium
- managing LLM tokens efficiently when using web-scraped data in context

# OUTCOMES
- Developed first multi-agent solution, practicing tool-use, orchestration, and memory 
- Agent is able to solve daily Wordle in 3-4 guesses on average (comparable to human performance)