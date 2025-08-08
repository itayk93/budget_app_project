#!/usr/bin/env python3
"""Update git_commits_log.xlsx with the latest commit"""

import pandas as pd
from datetime import datetime
import subprocess

try:
    # Get git info
    hash_result = subprocess.run(['git', 'log', '--oneline', '-1'], capture_output=True, text=True)
    commit_hash = hash_result.stdout.strip().split()[0] if hash_result.returncode == 0 else 'Unknown'
    
    msg_result = subprocess.run(['git', 'log', '--format=%s', '-1'], capture_output=True, text=True)
    commit_msg = msg_result.stdout.strip() if msg_result.returncode == 0 else 'Unknown'
    
    # Read existing log
    try:
        df = pd.read_excel('git_commits_log.xlsx')
    except:
        df = pd.DataFrame(columns=['Date & Time', 'Commit Hash', 'Commit Message', 'Files Changed', 'Additions (+)', 'Deletions (-)', 'Session Description', 'Status'])
    
    # Add new row
    new_row = {
        'Date & Time': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'Commit Hash': commit_hash,
        'Commit Message': commit_msg,
        'Files Changed': 12,
        'Additions (+)': 942,
        'Deletions (-)': 9,
        'Session Description': 'Critical Runtime Fixes - Complete Dashboard and Transaction Import Resolution',
        'Status': 'Local'
    }
    
    # Add to DataFrame
    df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
    df.to_excel('git_commits_log.xlsx', index=False)
    
    print(f"✅ Updated git_commits_log.xlsx with commit {commit_hash}")
    print(f"📊 Session: Critical Runtime Fixes - Complete resolution")
    print(f"📁 Files: 12 changed, +942 additions, -9 deletions")
    
except Exception as e:
    print(f"❌ Error updating git log: {e}")