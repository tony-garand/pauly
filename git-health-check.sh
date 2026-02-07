#!/bin/bash

# Git Repository Health Check
# Scans all git repos in ~/Projects and reports status

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

PROJECTS_DIR="$HOME/Projects"

main() {
    log "Starting Git Health Check"

    ensure_claude || return 1

    local report=""
    local issues_found=0
    local repos_checked=0
    local repos_pulled=0
    local repos_pushed=0

    # Find all git repositories
    while IFS= read -r git_dir; do
        repo_dir="$(dirname "$git_dir")"
        repo_name="$(basename "$repo_dir")"
        repos_checked=$((repos_checked + 1))

        cd "$repo_dir" || continue

        local repo_issues=""

        # Check for uncommitted changes
        if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
            local changed_count=$(git status --porcelain | wc -l | tr -d ' ')
            repo_issues+="  - $changed_count uncommitted changes\n"
            issues_found=$((issues_found + 1))
        fi

        # Check for unpushed commits and auto-push or open PR
        local unpushed=$(git log @{u}..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
        if [ "$unpushed" -gt 0 ]; then
            local current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
            log "Attempting to push $unpushed commits for $repo_name ($current_branch)..."
            if git push 2>/dev/null; then
                repo_issues+="  - ✅ Pushed $unpushed commits ($current_branch)\n"
                repos_pushed=$((repos_pushed + 1))
            else
                # Push failed - create a PR if gh is available
                if ensure_gh; then
                    local pr_branch="auto-push/${current_branch}-$(date '+%Y%m%d')"
                    git checkout -b "$pr_branch" 2>/dev/null
                    if git push -u origin "$pr_branch" 2>/dev/null; then
                        local main_branch_name=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
                        [ -z "$main_branch_name" ] && main_branch_name="main"
                        local pr_url=$(gh pr create --title "Auto-push: $unpushed commits from $current_branch" \
                            --body "Automated PR created by git-health-check because direct push to \`$current_branch\` failed (likely due to merge conflicts)." \
                            --base "$main_branch_name" 2>/dev/null)
                        repo_issues+="  - ⚠️ Push failed, opened PR: $pr_url\n"
                    else
                        repo_issues+="  - ❌ Push failed and could not create PR branch\n"
                        issues_found=$((issues_found + 1))
                    fi
                    git checkout "$current_branch" 2>/dev/null
                else
                    repo_issues+="  - ❌ $unpushed unpushed commits (push failed, gh CLI not available for PR)\n"
                    issues_found=$((issues_found + 1))
                fi
            fi
        fi

        # Check for stale branches (no commits in 30+ days)
        local stale_branches=""
        while IFS= read -r branch; do
            branch_name=$(echo "$branch" | sed 's/^[ *]*//')
            [ -z "$branch_name" ] && continue

            last_commit=$(git log -1 --format="%cr" "$branch_name" 2>/dev/null)
            if echo "$last_commit" | grep -qE "(month|year)"; then
                stale_branches+="$branch_name ($last_commit), "
            fi
        done < <(git branch 2>/dev/null)

        if [ -n "$stale_branches" ]; then
            repo_issues+="  - Stale branches: ${stale_branches%, }\n"
            issues_found=$((issues_found + 1))
        fi

        # Check if main/master is behind remote
        git fetch --quiet 2>/dev/null
        local main_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
        [ -z "$main_branch" ] && main_branch="main"

        local behind=$(git rev-list --count HEAD..origin/$main_branch 2>/dev/null || echo 0)
        if [ "$behind" -gt 0 ]; then
            # Auto-pull if working directory is clean
            if [ -z "$(git status --porcelain 2>/dev/null)" ]; then
                if git pull --quiet 2>/dev/null; then
                    repo_issues+="  - Pulled $behind commits from origin/$main_branch\n"
                    repos_pulled=$((repos_pulled + 1))
                else
                    repo_issues+="  - $behind commits behind origin/$main_branch (pull failed)\n"
                    issues_found=$((issues_found + 1))
                fi
            else
                repo_issues+="  - $behind commits behind origin/$main_branch (has local changes)\n"
                issues_found=$((issues_found + 1))
            fi
        fi

        # Add to report if issues found
        if [ -n "$repo_issues" ]; then
            report+="📁 $repo_name\n$repo_issues\n"
        fi

    done < <(find "$PROJECTS_DIR" -maxdepth 3 -name ".git" -type d 2>/dev/null)

    # Generate summary
    local summary="Git Health Check - $(date '+%Y-%m-%d')
========================================
Repositories scanned: $repos_checked
Repositories pulled: $repos_pulled
Repositories pushed: $repos_pushed
Issues found: $issues_found
"

    if [ -n "$report" ]; then
        summary+="\nRepositories with issues:\n\n$report"
    else
        summary+="\n✅ All repositories are clean!"
    fi

    # Use Claude to provide insights if there are issues
    if [ $issues_found -gt 0 ]; then
        log "Asking Claude for recommendations..."

        local claude_analysis=$(claude --print "Here's a git health check report for my projects. Provide brief, actionable recommendations for the most important items to address:

$summary" 2>/dev/null)

        summary+="\n========================================\nRecommendations:\n$claude_analysis"
    fi

    # Send email
    send_email "Git Health Check - $issues_found issues" "$(echo -e "$summary")"

    log "Git Health Check complete. $repos_checked repos scanned, $repos_pulled pulled, $repos_pushed pushed, $issues_found issues found."
}

run_with_alerts "git-health-check" main
