import asyncio
import sys
from verifiers import check_huggingface, check_google_fact_check, check_news_api, check_reality_defender

async def main():
    text = "Aliens landed in New York City yesterday and took over the Empire State Building."
    
    print("Testing HuggingFace...")
    hf = await check_huggingface(text)
    print(f"HuggingFace: {hf}")
    
    print("\nTesting Google Fact Check...")
    fc = await check_google_fact_check(text)
    print(f"Fact Check: {fc}")
    
    print("\nTesting News API...")
    news = await check_news_api(text)
    print(f"News API: {news}")
    
    print("\nTesting Reality Defender (Sapling)...")
    rd = await check_reality_defender(text)
    print(f"Reality Defender: {rd}")

if __name__ == "__main__":
    asyncio.run(main())
