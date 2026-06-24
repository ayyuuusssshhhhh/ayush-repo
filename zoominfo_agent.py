"""
ZoomInfo Contact Lookup Agent

Usage:
    python zoominfo_agent.py "John Smith at Microsoft"
    python zoominfo_agent.py "CEO of Salesforce"
    python zoominfo_agent.py "john.smith@company.com"
    python zoominfo_agent.py --company "OpenAI" --title "CTO"
"""

import anthropic
import json
import argparse
import sys

SYSTEM_PROMPT = """You are a ZoomInfo contact research agent. When given a query about a person or company,
you use ZoomInfo MCP tools to find and return detailed contact information.

Your workflow:
1. Parse the user query to identify: person name, company, job title, email, or other identifiers.
2. If searching by name/company/title → use search_contacts tool first to find the ZoomInfo person ID.
3. If you have a ZoomInfo person ID → use enrich_contacts to get full contact details.
4. If searching by company name only → use search_companies to find the company, then search_contacts with that company ID.
5. Return a clean, structured summary of the contact(s) found including:
   - Full Name
   - Job Title & Management Level
   - Company
   - Business Email
   - Direct Phone / Mobile
   - LinkedIn URL
   - Location

Always request these requiredFields in enrich_contacts:
firstName, lastName, email, jobTitle, managementLevel, phone, mobilePhone, externalUrls, companyName, jobFunction

If no contacts are found, say so clearly. Be concise and professional."""


def run_agent(query: str) -> None:
    client = anthropic.Anthropic()

    # ZoomInfo MCP server configuration
    mcp_servers = [
        {
            "type": "url",
            "url": "https://mcp.zoominfo.com/mcp",
            "name": "ZoomInfo",
        }
    ]

    messages = [{"role": "user", "content": query}]

    print(f"\n🔍 Searching ZoomInfo for: {query}\n{'─' * 50}")

    # Agentic loop
    while True:
        response = client.beta.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=messages,
            mcp_servers=mcp_servers,
            betas=["mcp-client-2025-04-04"],
        )

        # Collect assistant content
        assistant_content = []
        tool_uses = []

        for block in response.content:
            assistant_content.append(block)
            if block.type == "tool_use":
                tool_uses.append(block)
                print(f"  ⚙️  Calling: {block.name}")

        messages.append({"role": "assistant", "content": assistant_content})

        # Check stop reason
        if response.stop_reason == "end_turn":
            # Print final text response
            for block in response.content:
                if hasattr(block, "text"):
                    print(f"\n{block.text}")
            break

        # If the model used tools, the MCP client handles results automatically.
        # For non-MCP tool_use (shouldn't happen here), we'd need to handle manually.
        # With mcp_servers set, tool results are injected by the SDK automatically.
        # We just continue the loop.
        if response.stop_reason != "tool_use":
            # Unexpected stop reason
            for block in response.content:
                if hasattr(block, "text"):
                    print(f"\n{block.text}")
            break


def main():
    parser = argparse.ArgumentParser(
        description="ZoomInfo Contact Lookup Agent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python zoominfo_agent.py "John Smith at Microsoft"
  python zoominfo_agent.py "CEO of Salesforce"
  python zoominfo_agent.py "VP Engineering at OpenAI"
  python zoominfo_agent.py "jane.doe@example.com"
  python zoominfo_agent.py "Find CFOs at fintech companies in New York"
        """,
    )
    parser.add_argument(
        "query",
        nargs="?",
        help="Natural language query for the contact you want to find",
    )
    parser.add_argument("--company", help="Company name to search within")
    parser.add_argument("--title", help="Job title to search for")
    parser.add_argument("--name", help="Contact full name")
    parser.add_argument("--email", help="Contact email address")

    args = parser.parse_args()

    # Build query from flags or positional arg
    if args.query:
        query = args.query
    else:
        parts = []
        if args.name:
            parts.append(f"Find contact: {args.name}")
        if args.title:
            parts.append(f"Job title: {args.title}")
        if args.company:
            parts.append(f"Company: {args.company}")
        if args.email:
            parts.append(f"Email: {args.email}")
        if not parts:
            parser.print_help()
            sys.exit(1)
        query = ", ".join(parts)

    run_agent(query)


if __name__ == "__main__":
    main()
