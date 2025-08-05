#!/usr/bin/env python3
import pandas as pd
from datetime import datetime
import subprocess
import os

def update_git_log():
    # Change to project directory
    os.chdir('/Users/itaykarkason/Python Projects/budget_app_project')
    
    # Get the last 5 commits
    result = subprocess.run(['git', 'log', '--oneline', '-5'], capture_output=True, text=True)
    commits = result.stdout.strip().split('\n')
    
    # Read existing log or create new
    try:
        df = pd.read_excel('git_commits_log.xlsx')
        print(f"Loaded existing log with {len(df)} entries")
    except FileNotFoundError:
        df = pd.DataFrame(columns=['Date & Time', 'Commit Hash', 'Commit Message', 'Files Changed', 'Additions (+)', 'Deletions (-)', 'Session Description', 'Status'])
        print("Created new git log file")
    
    # Process each commit
    new_entries = []
    for commit_line in commits:
        if not commit_line:
            continue
            
        parts = commit_line.split(' ', 1)
        if len(parts) < 2:
            continue
            
        commit_hash = parts[0]
        commit_message = parts[1]
        
        # Check if this commit already exists
        if commit_hash in df['Commit Hash'].values:
            print(f"Commit {commit_hash} already exists, skipping")
            continue
        
        # Get commit stats
        stat_result = subprocess.run(['git', 'show', '--stat', '--format=', commit_hash], capture_output=True, text=True)
        files_changed = additions = deletions = 0
        
        if stat_result.returncode == 0:
            lines = stat_result.stdout.strip().split('\n')
            for line in lines:
                if 'files changed' in line or 'file changed' in line:
                    parts = line.split()
                    for i, part in enumerate(parts):
                        if 'file' in part and i > 0:
                            try:
                                files_changed = int(parts[i-1])
                            except (ValueError, IndexError):
                                pass
                        elif 'insertion' in part and i > 0:
                            try:
                                additions = int(parts[i-1])
                            except (ValueError, IndexError):
                                pass
                        elif 'deletion' in part and i > 0:
                            try:
                                deletions = int(parts[i-1])
                            except (ValueError, IndexError):
                                pass
        
        # Get commit date
        date_result = subprocess.run(['git', 'show', '-s', '--format=%ci', commit_hash], capture_output=True, text=True)
        commit_date = datetime.now().strftime('%Y-%m-%d %H:%M')
        if date_result.returncode == 0:
            try:
                commit_datetime = datetime.fromisoformat(date_result.stdout.strip().replace(' +0200', '').replace(' +0300', ''))
                commit_date = commit_datetime.strftime('%Y-%m-%d %H:%M')
            except:
                pass
        
        # Determine session description based on commit message
        session_description = "Transaction splitting feature implementation"
        if "[Fix]" in commit_message:
            session_description = "Bug fixes for transaction splitting"
        elif "[Feature]" in commit_message and "visual" in commit_message:
            session_description = "Visual indicators for split transactions"
        elif "[Feature]" in commit_message and "unsplit" in commit_message:
            session_description = "Unsplit functionality for split transactions"
        
        new_entry = {
            'Date & Time': commit_date,
            'Commit Hash': commit_hash,
            'Commit Message': commit_message,
            'Files Changed': files_changed,
            'Additions (+)': additions,
            'Deletions (-)': deletions,
            'Session Description': session_description,
            'Status': 'Pushed'
        }
        
        new_entries.append(new_entry)
        print(f"Added commit {commit_hash}: {commit_message}")
    
    if new_entries:
        # Add new entries to dataframe
        new_df = pd.DataFrame(new_entries)
        df = pd.concat([new_df, df], ignore_index=True)
        
        # Save updated log
        df.to_excel('git_commits_log.xlsx', index=False)
        print(f"Updated git_commits_log.xlsx with {len(new_entries)} new entries")
        print(f"Total entries in log: {len(df)}")
    else:
        print("No new commits to add")

if __name__ == "__main__":
    update_git_log()