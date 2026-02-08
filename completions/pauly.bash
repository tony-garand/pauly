# Bash completion for Pauly CLI
# Add to ~/.bashrc: source ~/.pauly/completions/pauly.bash

_pauly_completions() {
    local cur prev words cword
    _init_completion || return

    # Main commands
    local commands="run dev admin tui railway status logs tail enable disable test-email setup install config autofix queue doctor kill version help"

    # Job names
    local jobs="summary git research tasks all"

    # Dev subcommands
    local dev_commands="init refresh task status"

    # Templates
    local templates="react-vite express-api fullstack cli-tool list"

    # Admin subcommands
    local admin_commands="start stop status restart logs"

    # Railway subcommands
    local railway_commands="deploy link status logs env init open login whoami help"

    # Config subcommands
    local config_commands="show"

    # Autofix subcommands
    local autofix_commands="status test logs"

    # Queue subcommands
    local queue_commands="status list cleanup"

    case "$prev" in
        pauly)
            COMPREPLY=($(compgen -W "$commands" -- "$cur"))
            return
            ;;
        run)
            COMPREPLY=($(compgen -W "$jobs -bg --background" -- "$cur"))
            return
            ;;
        dev)
            COMPREPLY=($(compgen -W "$dev_commands --dry-run -n" -- "$cur"))
            return
            ;;
        admin)
            COMPREPLY=($(compgen -W "$admin_commands" -- "$cur"))
            return
            ;;
        railway)
            COMPREPLY=($(compgen -W "$railway_commands" -- "$cur"))
            return
            ;;
        config)
            COMPREPLY=($(compgen -W "$config_commands" -- "$cur"))
            return
            ;;
        autofix)
            COMPREPLY=($(compgen -W "$autofix_commands" -- "$cur"))
            return
            ;;
        queue)
            COMPREPLY=($(compgen -W "$queue_commands" -- "$cur"))
            return
            ;;
        logs|tail)
            local log_jobs="summary git research tasks admin autofix dev background"
            COMPREPLY=($(compgen -W "$log_jobs -f --follow -n" -- "$cur"))
            return
            ;;
        enable|disable)
            COMPREPLY=($(compgen -W "$jobs dev" -- "$cur"))
            return
            ;;
        version)
            COMPREPLY=($(compgen -W "--check -c" -- "$cur"))
            return
            ;;
        init)
            # Complete .md files for dev init
            COMPREPLY=($(compgen -f -X '!*.md' -- "$cur"))
            return
            ;;
        -n)
            # Suggest common iteration counts
            COMPREPLY=($(compgen -W "5 10 15 25 50" -- "$cur"))
            return
            ;;
        --template|-t)
            # Suggest templates
            COMPREPLY=($(compgen -W "$templates" -- "$cur"))
            return
            ;;
        --branch)
            # Complete git branches
            if command -v git &>/dev/null && [ -d .git ]; then
                local branches=$(git branch --format='%(refname:short)' 2>/dev/null)
                COMPREPLY=($(compgen -W "$branches" -- "$cur"))
            fi
            return
            ;;
        -f|--file)
            # Complete files
            COMPREPLY=($(compgen -f -- "$cur"))
            return
            ;;
    esac

    # Handle options based on command context
    case "${words[1]}" in
        dev)
            case "$cur" in
                -*)
                    COMPREPLY=($(compgen -W "--dry-run -n --branch --no-pr -f --file" -- "$cur"))
                    ;;
            esac
            ;;
        logs)
            case "$cur" in
                -*)
                    COMPREPLY=($(compgen -W "-f --follow -n" -- "$cur"))
                    ;;
            esac
            ;;
    esac
}

complete -F _pauly_completions pauly
