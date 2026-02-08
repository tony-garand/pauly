#compdef pauly

# Zsh completion for Pauly CLI
# Add to ~/.zshrc: source ~/.pauly/completions/pauly.zsh

_pauly() {
    local line state

    _arguments -C \
        "1: :->command" \
        "*::arg:->args"

    case $state in
        command)
            _values 'pauly commands' \
                'run[Run a job manually]' \
                'dev[Autonomous development mode]' \
                'admin[Manage admin dashboard]' \
                'tui[Interactive terminal dashboard]' \
                'railway[Railway deployment commands]' \
                'status[Show status of all scheduled jobs]' \
                'logs[View logs]' \
                'tail[Follow logs in real-time]' \
                'enable[Enable a scheduled job]' \
                'disable[Disable a scheduled job]' \
                'test-email[Send a test email]' \
                'setup[Run the Mac Mini setup script]' \
                'install[Install all npm dependencies]' \
                'config[Configure settings]' \
                'autofix[Show auto-fix status]' \
                'queue[Manage task queue]' \
                'doctor[Run system health checks]' \
                'kill[Stop all Claude processes]' \
                'version[Show version]' \
                'help[Show help message]'
            ;;
        args)
            case $line[1] in
                run)
                    _values 'jobs' \
                        'summary[Daily Claude activity summary]' \
                        'git[Git repository health check]' \
                        'research[Project competitive analysis]' \
                        'tasks[Check for tasks]' \
                        'all[Run all jobs]' \
                        '-bg[Run in background]' \
                        '--background[Run in background]'
                    ;;
                dev)
                    if [[ $CURRENT -eq 2 ]]; then
                        _values 'dev commands' \
                            'init[Bootstrap project from idea file]' \
                            'refresh[Add tasks from notes]' \
                            'task[Run isolated single-task mode]' \
                            'status[Show development progress]' \
                            '--dry-run[Preview without executing]' \
                            '-n[Max iterations]'
                    else
                        case $line[2] in
                            init)
                                _arguments \
                                    '--template[Use project template]:template:(react-vite express-api fullstack cli-tool list)' \
                                    '-t[Use project template]:template:(react-vite express-api fullstack cli-tool list)' \
                                    '*:idea file:_files -g "*.md"'
                                ;;
                            refresh)
                                _files -g '*.md'
                                ;;
                            task)
                                _arguments \
                                    '--branch[Use custom branch name]:branch:' \
                                    '--no-pr[Skip PR creation]' \
                                    '-n[Max iterations]:number:(5 10 15 25 50)' \
                                    '-f[Read task from file]:file:_files' \
                                    '--file[Read task from file]:file:_files'
                                ;;
                        esac
                    fi
                    ;;
                admin)
                    _values 'admin commands' \
                        'start[Start the dashboard]' \
                        'stop[Stop the dashboard]' \
                        'status[Check dashboard status]' \
                        'restart[Restart the dashboard]' \
                        'logs[View dashboard logs]'
                    ;;
                railway)
                    _values 'railway commands' \
                        'deploy[Deploy to Railway]' \
                        'link[Link to Railway project]' \
                        'status[Check deployment status]' \
                        'logs[View deployment logs]' \
                        'env[Manage environment variables]' \
                        'init[Initialize new Railway project]' \
                        'open[Open project in browser]' \
                        'login[Authenticate with Railway]' \
                        'whoami[Show current Railway user]' \
                        'help[Show Railway help]'
                    ;;
                config)
                    _values 'config commands' \
                        'show[Show current configuration]'
                    ;;
                autofix)
                    _values 'autofix commands' \
                        'status[Show auto-fix status]' \
                        'test[Test auto-fix with simulated failure]' \
                        'logs[View auto-fix logs]'
                    ;;
                queue)
                    _values 'queue commands' \
                        'status[Show queue status]' \
                        'list[List jobs in queue]' \
                        'cleanup[Cleanup stale and old jobs]'
                    ;;
                logs|tail)
                    _arguments \
                        '-f[Follow logs in real-time]' \
                        '--follow[Follow logs in real-time]' \
                        '-n[Number of lines]:number:(10 50 100 500)' \
                        '1:job:(summary git research tasks admin autofix dev background)'
                    ;;
                enable|disable)
                    _values 'jobs' \
                        'summary[Daily summary job]' \
                        'git[Git health check job]' \
                        'research[Research job]' \
                        'tasks[Tasks checker job]' \
                        'dev[Dev process job]' \
                        'all[All jobs]'
                    ;;
                version)
                    _values 'options' \
                        '--check[Check for updates]' \
                        '-c[Check for updates]'
                    ;;
            esac
            ;;
    esac
}

_pauly "$@"
