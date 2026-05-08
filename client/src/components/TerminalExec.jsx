import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import socket from "../utils/socket";
import {
  TerminalSquare,
  Play,
  Square,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";

// ── Interactive xterm.js Terminal ─────────────────────────────────────────────
const InteractiveTerminal = ({ containerId, isRunning, visible = true }) => {
  const termRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const startShell = () => {
    if (!isRunning) return;
    setIsConnecting(true);

    // Initialize xterm only once
    if (!xtermRef.current && termRef.current) {
      const term = new Terminal({
        cursorBlink: true,
        fontSize: 12,
        fontFamily:
          "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', monospace",
        lineHeight: 1.35,
        letterSpacing: 0,
        theme: {
          background: "#0a0e14",
          foreground: "#b3b1ad",
          cursor: "#e6b450",
          cursorAccent: "#0a0e14",
          selectionBackground: "#1d3b58",
          selectionForeground: "#ffffff",
          black: "#01060e",
          red: "#ea6c73",
          green: "#91b362",
          yellow: "#f9af4f",
          blue: "#53bdfa",
          magenta: "#fae994",
          cyan: "#90e1c6",
          white: "#c7c7c7",
          brightBlack: "#686868",
          brightRed: "#f07178",
          brightGreen: "#c2d94c",
          brightYellow: "#ffb454",
          brightBlue: "#59c2ff",
          brightMagenta: "#ffee99",
          brightCyan: "#95e6cb",
          brightWhite: "#ffffff",
        },
        scrollback: 2000,
        convertEol: true,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(termRef.current);

      setTimeout(() => fitAddon.fit(), 50);

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Send user input to backend
      term.onData((data) => {
        socket.emit("exec-input", { containerId, data });
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit();
          const { cols, rows } = term;
          socket.emit("exec-resize", { containerId, cols, rows });
        } catch {
          // ignore resize errors
        }
      });
      resizeObserver.observe(termRef.current);
    }

    // Socket event handlers
    const handleOutput = ({ id, data }) => {
      if (id === containerId && xtermRef.current) {
        xtermRef.current.write(data);
      }
    };

    const handleReady = ({ id }) => {
      if (id === containerId) {
        setIsConnected(true);
        setIsConnecting(false);
        if (xtermRef.current) {
          xtermRef.current.clear();
          xtermRef.current.focus();
        }
      }
    };

    const handleExit = ({ id }) => {
      if (id === containerId) {
        setIsConnected(false);
        if (xtermRef.current) {
          xtermRef.current.writeln(
            "\r\n\x1b[38;2;234;108;115m── session ended ──\x1b[0m\r\n",
          );
        }
      }
    };

    const handleError = ({ id, error }) => {
      if (id === containerId) {
        setIsConnecting(false);
        if (xtermRef.current) {
          xtermRef.current.writeln(
            `\r\n\x1b[38;2;234;108;115m✖ ${error}\x1b[0m`,
          );
        }
      }
    };

    socket.on("exec-output", handleOutput);
    socket.on("exec-ready", handleReady);
    socket.on("exec-exit", handleExit);
    socket.on("exec-error", handleError);

    // Start the shell
    socket.emit("exec-start", { containerId });

    return () => {
      socket.off("exec-output", handleOutput);
      socket.off("exec-ready", handleReady);
      socket.off("exec-exit", handleExit);
      socket.off("exec-error", handleError);
    };
  };

  const stopShell = () => {
    socket.emit("exec-stop", containerId);
    setIsConnected(false);
  };

  // Refit terminal when becoming visible again
  useEffect(() => {
    if (visible && fitAddonRef.current && xtermRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current.fit();
          xtermRef.current.focus();
        } catch {
          // ignore
        }
      }, 50);
    }
  }, [visible]);

  // Cleanup on unmount (only when sidebar truly closes)
  useEffect(() => {
    return () => {
      socket.emit("exec-stop", containerId);
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, [containerId]);

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Terminal chrome header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0f1318] border border-gray-700/40 border-b-0 rounded-t-xl">
        <div className="flex items-center gap-2.5">
          {/* Traffic light dots */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                isConnected
                  ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]"
                  : "bg-gray-700"
              }`}
            />
            <span
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                isConnecting ? "bg-yellow-500 animate-pulse" : "bg-gray-700"
              }`}
            />
            <span className="w-2.5 h-2.5 rounded-full bg-gray-700" />
          </div>

          {/* Shell label */}
          <div className="flex items-center gap-1.5 ml-1">
            <TerminalSquare size={12} className="text-gray-500" />
            <span className="text-[11px] font-medium text-gray-500">
              {isConnected ? "bash" : "shell"}
            </span>
          </div>
        </div>

        {/* Connection controls */}
        <div className="flex items-center gap-2">
          {isConnected && (
            <span className="flex items-center gap-1.5 text-[10px] text-green-500/80 font-medium mr-1">
              <Wifi size={10} />
              live
            </span>
          )}
          {!isConnected ? (
            <button
              onClick={startShell}
              disabled={!isRunning || isConnecting}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-[11px] font-medium hover:bg-green-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {isConnecting ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Play size={11} />
              )}
              {isConnecting ? "Connecting" : "Connect"}
            </button>
          ) : (
            <button
              onClick={stopShell}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-[11px] font-medium hover:bg-red-500/20 transition-all active:scale-95"
            >
              <Square size={9} />
              End
            </button>
          )}
        </div>
      </div>

      {/* Terminal body */}
      <div className="relative flex-1">
        <div
          ref={termRef}
          className="absolute inset-0 rounded-b-xl border border-gray-700/40 border-t-0 overflow-hidden"
          style={{
            minHeight: "300px",
            backgroundColor: "#0a0e14",
          }}
        />
        {/* Idle state overlay */}
        {!isConnected && !isConnecting && (
          <div className="absolute inset-0 rounded-b-xl flex flex-col items-center justify-center bg-[#0a0e14]/90 z-10 border border-gray-700/40 border-t-0">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-800/80 border border-gray-700/50 flex items-center justify-center">
                <TerminalSquare
                  size={22}
                  className="text-gray-600"
                />
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 font-medium">
                  {isRunning
                    ? "Click Connect to start a shell session"
                    : "Container must be running"}
                </p>
                {!isRunning && (
                  <p className="text-[10px] text-gray-600 mt-1 flex items-center gap-1 justify-center">
                    <WifiOff size={10} />
                    Start the container first
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Exported Component ───────────────────────────────────────────────────────
const TerminalExec = ({ containerId, isRunning, visible = true }) => {
  return (
    <InteractiveTerminal
      containerId={containerId}
      isRunning={isRunning}
      visible={visible}
    />
  );
};

export default TerminalExec;
