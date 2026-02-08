import { startDev, stopDev, restartDev, killSession, killAllProcesses, addTask, updateConfig, deleteConfig, fetchProjects, fetchSessions, fetchQueueStats, fetchPaulyStatus, } from "../api/endpoints.js";
const API_BASE = "http://localhost:3001/api";
const SCREEN_ALIASES = {
    dashboard: 1, dash: 1, "1": 1,
    projects: 2, proj: 2, "2": 2,
    logs: 3, log: 3, "3": 3,
    queue: 4, "4": 4,
    config: 5, "5": 5,
    sessions: 6, sess: 6, "6": 6,
};
const BUILTIN_HELP = `Built-in commands:
  dev start|stop|restart <project>    Dev process control
  kill <pid>                          Kill a Claude session
  kill all                            Kill all Claude sessions
  task <project> <text>               Add a task to a project
  config set <key> <value>            Set a config value
  config delete <key>                 Delete a config key
  go <screen>                         Navigate (dashboard,projects,logs,queue,config,sessions)
  status                              Show Pauly status summary
  projects                            List projects
  sessions                            List Claude sessions
  help                                Show this help
  quit | q                            Exit TUI

Anything else is sent to Claude as a prompt.`;
export async function executeCommand(raw, onStream) {
    const trimmed = raw.trim();
    if (!trimmed)
        return { output: "" };
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    try {
        // Navigation
        if (cmd === "go" && parts[1]) {
            const tab = SCREEN_ALIASES[parts[1].toLowerCase()];
            if (tab)
                return { output: `Switched to ${parts[1]}`, navigate: tab };
            return { output: `Unknown screen: ${parts[1]}. Try: dashboard, projects, logs, queue, config, sessions`, error: true };
        }
        // Quit
        if (cmd === "quit" || cmd === "q" || cmd === "exit") {
            return { output: "__EXIT__" };
        }
        // Help
        if (cmd === "help" || cmd === "?") {
            return { output: BUILTIN_HELP };
        }
        // Dev controls
        if (cmd === "dev") {
            const action = parts[1]?.toLowerCase();
            const project = parts.slice(2).join(" ");
            if (!action || !project)
                return { output: "Usage: dev start|stop|restart <project>", error: true };
            if (action === "start") {
                await startDev(project);
                return { output: `Dev started for ${project}` };
            }
            else if (action === "stop") {
                await stopDev(project);
                return { output: `Dev stopped for ${project}` };
            }
            else if (action === "restart") {
                await restartDev(project);
                return { output: `Dev restarted for ${project}` };
            }
            return { output: `Unknown dev action: ${action}`, error: true };
        }
        // Kill
        if (cmd === "kill") {
            if (parts[1]?.toLowerCase() === "all") {
                const result = await killAllProcesses();
                return { output: `Killed ${result.killed} Claude processes` };
            }
            const pid = parseInt(parts[1] ?? "", 10);
            if (isNaN(pid))
                return { output: "Usage: kill <pid> | kill all", error: true };
            await killSession(pid);
            return { output: `Killed PID ${pid}` };
        }
        // Task
        if (cmd === "task") {
            const project = parts[1];
            const text = parts.slice(2).join(" ");
            if (!project || !text)
                return { output: "Usage: task <project> <text>", error: true };
            await addTask(project, text);
            return { output: `Task added to ${project}` };
        }
        // Config
        if (cmd === "config") {
            const action = parts[1]?.toLowerCase();
            if (action === "set") {
                const key = parts[2];
                const value = parts.slice(3).join(" ");
                if (!key || !value)
                    return { output: "Usage: config set <key> <value>", error: true };
                await updateConfig(key, value);
                return { output: `Config set: ${key} = ${value}` };
            }
            else if (action === "delete" || action === "del" || action === "rm") {
                const key = parts[2];
                if (!key)
                    return { output: "Usage: config delete <key>", error: true };
                await deleteConfig(key);
                return { output: `Config deleted: ${key}` };
            }
            return { output: "Usage: config set <key> <value> | config delete <key>", error: true };
        }
        // Status
        if (cmd === "status") {
            const status = await fetchPaulyStatus();
            const lines = [`Pauly Status — ${status.jobs.length} scheduled jobs:`];
            for (const job of status.jobs) {
                lines.push(`  ${job.name.padEnd(15)} ${job.schedule}`);
            }
            return { output: lines.join("\n") };
        }
        // Projects list
        if (cmd === "projects" || cmd === "ls") {
            const { projects } = await fetchProjects();
            if (projects.length === 0)
                return { output: "No projects found" };
            const lines = projects.map((p) => `  ${p.name.padEnd(22)} ${p.devStatus?.status ?? "—"}`);
            return { output: `Projects (${projects.length}):\n${lines.join("\n")}` };
        }
        // Sessions list
        if (cmd === "sessions" || cmd === "ps") {
            const data = await fetchSessions();
            if (data.totalProcesses === 0)
                return { output: "No active Claude sessions" };
            const lines = [`${data.totalProcesses} active sessions:`];
            for (const g of data.groups) {
                lines.push(`  ${g.project} (${g.processes.length} proc, CPU: ${g.totalCpu.toFixed(1)}%)`);
                for (const p of g.processes) {
                    lines.push(`    PID ${p.pid}  ${p.mode.padEnd(8)} CPU:${p.cpu.toFixed(1)}% MEM:${p.mem.toFixed(1)}%  ${p.uptime}`);
                }
            }
            return { output: lines.join("\n") };
        }
        // Queue stats
        if (cmd === "queue") {
            const stats = await fetchQueueStats();
            return {
                output: `Queue: ${stats.pending} pending, ${stats.running} running, ${stats.completed} completed, ${stats.failed} failed`,
            };
        }
        // Fallback: send to Claude as a prompt
        return await streamClaude(trimmed, onStream);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { output: msg, error: true };
    }
}
async function streamClaude(prompt, onStream) {
    const response = await fetch(`${API_BASE}/pauly/claude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
    });
    if (!response.ok) {
        let msg = `API error: ${response.status}`;
        try {
            const data = await response.json();
            if (data.error)
                msg = data.error;
        }
        catch { }
        return { output: msg, error: true };
    }
    const reader = response.body?.getReader();
    if (!reader)
        return { output: "No response body", error: true };
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        // Parse SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete line
        for (const line of lines) {
            if (!line.startsWith("data: "))
                continue;
            const jsonStr = line.slice(6);
            try {
                const event = JSON.parse(jsonStr);
                if (event.type === "content" && event.text) {
                    fullText += event.text;
                    onStream(event.text);
                }
                else if (event.type === "error" && event.text) {
                    fullText += `\n[Error: ${event.text}]`;
                    onStream(`\n[Error: ${event.text}]`);
                }
                // "done" — loop will end on next read
            }
            catch {
                // skip malformed SSE
            }
        }
    }
    return { output: fullText || "(no response)" };
}
