
Product Requirements Document (PRD)
Product Name: Reddit Sentiment Analyzer for Codex CLI Ecosystem

1. Objective
Build a simple, transparent web application for analyzing and visualizing the sentiment of posts and comments in key Reddit communities related to generative AI and Codex CLI tools. Target subreddits: r/chatgpt, r/openai, r/chatgptpro, r/codex.

2. User Stories
Users can view the daily/weekly/monthly sentiment (positive/neutral/negative) trends for each target subreddit.
Users can compare sentiment and activity across the four subreddits within the chosen time window.
Users can view a ranked/tabled list of recent posts with their individual sentiment scores.
Users can view method/documentation for sentiment interpretation.
[Optional] Users can filter by keyword or download sentiment results.

3. Scope & Features
Core Features
Subreddit Selection:
Fixed: r/chatgpt, r/openai, r/chatgptpro, r/codex
Timeframe Setting:
Default: 7 days. Options: last 24h, 7 days, 30 days.
Data Ingestion:
Fetch a set (e.g., up to 100) of the most recent posts per subreddit in the time window.
Gather top-level comments for each post (up to 50 per post).
Sentiment Analysis:
Use an established NLP library or API (such as VADER, TextBlob, or Huggingface model) to analyze each post/comment.
Assign each post and comment a sentiment: Positive / Neutral / Negative.
Visualization:
Line chart for sentiment trends per subreddit and timeframe.
Pie or bar charts for subreddit-wide sentiment breakdowns.
Table/list of the latest posts (with sentiment scores and recent comments if feasible).
Transparency:
“Methodology” page detailing algorithm, data source, sample sizes, and limitations.
Manual Refresh:
Button for user-initiated re-loading of most current data.
Nice-to-have/Optional Features
Keyword/topic search/filter within results.
Export data as CSV.
Sentiment per comment, visualized in post detail modal.
Mobile optimization.

4. Methodology

1. Data Source
All data is fetched directly from Reddit’s public API.
Only these subreddits are analyzed: r/chatgpt, r/openai, r/chatgptpro, r/codex.
For each subreddit:
Recent posts (up to 100 per query, timeframe-adjustable).
Top-level comments (up to 50 per post).
2. Sentiment Model
Each post/comment is assessed using an NLP sentiment framework (VADER, TextBlob, or Transformer).
Sentiment labels:
Positive: Overall favorable or optimistic tone.
Neutral: Factual or ambiguous tone.
Negative: Unfavorable or pessimistic tone.
Scores normalized per item.
3. Aggregation
Count and display the number of positive, neutral, and negative posts/comments.
Show time trends (breakdowns by day/hour, as relevant).
Optionally, weight posts vs. comments separately.
4. Visualization
Interactive line graphs for sentiment trend per subreddit.
Pie/bar charts of total post/comment sentiment per subreddit.
Tables/lists of recent top posts and their sentiment.
5. Limitations
The sentiment model cannot perfectly capture sarcasm, slang, or specific community in-jokes.
API access may restrict batch sizes/data freshness.
Only public posts and top-level comments are included (no private messages/removed content).
The tool offers directional insight, not statistical/scientific rigor.
6. Transparency
Methodology, model, and open-source code links (if open) displayed in the app.
Date/time of last data refresh shown to users.
All calculations explained to users via the “Methodology” page/dialog.
5. Technical Specifications
Frontend: React or similar lightweight JS framework.
Backend: Node.js/Python for API proxy, sentiment scoring, and aggregation.
Sentiment Analysis:
Use Python’s NLTK/VADER, TextBlob, or Huggingface transformer API for processing.
Data Storage:
No long-term storage unless user opts to export—operate in-memory for live analysis.
Deployment:
Frontend: Vercel/Netlify/Static SPA.
Backend: Lightweight API or serverless functions on AWS/GCP/Heroku.
Hosting:
Static web hosting for the frontend.
Minimal cloud-hosted backend for API/proxy.
6. Non-functional Requirements
Simple, clean, accessible UI.
Mobile and desktop responsive.
Updates data on demand (not real-time streaming).
Reasonable API rate limiting and graceful error handling.
Methodology/documentation page is always accessible for context and transparency.
7. Reference/Comparables
claudometer.app for methodology, data presentation, and user experience.