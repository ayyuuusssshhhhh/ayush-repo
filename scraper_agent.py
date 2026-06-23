#!/usr/bin/env python3
"""
Web Scraper Agent — give it a URL and a query, get an answer.

Usage:
    python scraper_agent.py --url <URL> --query "<your question>"

Requirements:
    pip install anthropic requests beautifulsoup4 lxml
"""

import argparse
import sys
import re

import requests
from bs4 import BeautifulSoup
import anthropic


def fetch_page_text(url: str, timeout: int = 15) -> str:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        )
    }
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")

    # Remove noisy tags
    for tag in soup(["script", "style", "noscript", "head", "nav", "footer", "aside"]):
        tag.decompose()

    text = soup.get_text(separator="\n")
    # Collapse excess whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def answer_query(url: str, query: str, max_chars: int = 40_000) -> str:
    print(f"Fetching: {url}")
    page_text = fetch_page_text(url)

    # Truncate to stay within context limits
    if len(page_text) > max_chars:
        page_text = page_text[:max_chars] + "\n\n[... content truncated ...]"

    client = anthropic.Anthropic()

    system = (
        "You are a precise web-scraping assistant. "
        "The user provides scraped text from a webpage and asks a question about it. "
        "Answer only from the provided content. If the answer is not in the text, say so clearly."
    )

    user_message = (
        f"URL: {url}\n\n"
        f"--- PAGE CONTENT ---\n{page_text}\n--- END ---\n\n"
        f"Query: {query}"
    )

    print("Querying Claude...\n")
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=system,
        messages=[{"role": "user", "content": user_message}],
    )

    return message.content[0].text


def main():
    parser = argparse.ArgumentParser(description="Web Scraper Agent powered by Claude")
    parser.add_argument("--url", required=True, help="URL of the page to scrape")
    parser.add_argument("--query", required=True, help="Question to answer from the page")
    args = parser.parse_args()

    try:
        answer = answer_query(args.url, args.query)
        print("=" * 60)
        print("ANSWER")
        print("=" * 60)
        print(answer)
    except requests.HTTPError as e:
        print(f"HTTP error fetching page: {e}", file=sys.stderr)
        sys.exit(1)
    except requests.RequestException as e:
        print(f"Network error: {e}", file=sys.stderr)
        sys.exit(1)
    except anthropic.APIError as e:
        print(f"Claude API error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
