#!/usr/bin/env python3
"""
Script to view generated classification signals
"""

import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.clustering import ClassificationSignal


def view_signals():
    """View all classification signals"""

    workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

    db = SessionLocal()
    try:
        # Get all signals
        signals = db.query(ClassificationSignal).filter(
            ClassificationSignal.workspace_id == workspace_id,
            ClassificationSignal.is_active == True
        ).order_by(ClassificationSignal.created_at.desc()).all()

        if not signals:
            print("❌ No classification signals found!")
            return

        print(f"🔍 CLASSIFICATION SIGNALS ({len(signals)} total)")
        print(f"=" * 70)

        # Group by signal type
        signals_by_type = {}
        for signal in signals:
            signal_type = signal.signal_type
            if signal_type not in signals_by_type:
                signals_by_type[signal_type] = []
            signals_by_type[signal_type].append(signal)

        for signal_type, type_signals in signals_by_type.items():
            print(f"\n📊 {signal_type.upper()} SIGNALS ({len(type_signals)}):")
            print("-" * 50)

            for i, signal in enumerate(type_signals, 1):
                print(f"{i}. 🎯 {signal.signal_name}")
                print(f"   📂 Category: {signal.target_category}")
                print(f"   🎨 Theme: {signal.target_theme}")
                print(f"   ⚖️  Weight: {signal.priority_weight}")
                print(f"   📊 Usage: {signal.usage_count} times")

                if signal.keywords:
                    print(f"   🔑 Keywords: {signal.keywords}")
                if signal.patterns:
                    print(f"   🔍 Patterns: {signal.patterns}")
                if signal.semantic_threshold:
                    print(f"   🧠 Semantic threshold: {signal.semantic_threshold}")
                if signal.business_rules:
                    print(f"   📋 Business rules: {signal.business_rules}")

                print()

        # Summary stats
        total_signals = len(signals)
        active_signals = len([s for s in signals if s.is_active])

        print(f"📈 SUMMARY:")
        print(f"   📊 Total signals: {total_signals}")
        print(f"   ✅ Active signals: {active_signals}")
        print(f"   🎯 Signal types: {len(signals_by_type)}")
        print()

        print(f"🚀 FAST CLASSIFICATION IS READY!")
        print(f"The system can now classify new messages using these {total_signals} signals:")
        for signal_type, type_signals in signals_by_type.items():
            print(f"   • {len(type_signals)} {signal_type} signals")
        print()
        print(f"Each new message will be checked against all signals to determine:")
        print(f"   📂 Category (Core Features, Integrations, UI/UX, etc.)")
        print(f"   🎨 Theme (Productivity, Customer Experience, Security, etc.)")
        print(f"   📊 Confidence score for classification accuracy")

    finally:
        db.close()


if __name__ == "__main__":
    view_signals()