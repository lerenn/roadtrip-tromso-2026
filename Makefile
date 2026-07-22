SHELL := /bin/bash
.ONESHELL:

APP_DIR := app
PID_FILE := .app.pid
LOG_FILE := .app.log
HOST ?= 127.0.0.1
PORT ?= 5173
URL := http://$(HOST):$(PORT)/

.PHONY: help install start stop restart status build preview clean

help:
	@echo "Tromsø roadbook"
	@echo "  make install  — npm install in app/"
	@echo "  make start    — start Vite dev server (background)"
	@echo "  make stop     — stop the dev server"
	@echo "  make restart  — stop + start"
	@echo "  make status   — show whether the server is running"
	@echo "  make build    — production build → app/dist"
	@echo "  make preview  — serve the production build"
	@echo "  make clean    — remove dist, logs, pid"

install:
	cd $(APP_DIR) && npm install

start: install
	@set -e
	if curl -sf -o /dev/null "$(URL)"; then
		echo "Already running → $(URL)"
		exit 0
	fi
	rm -f $(PID_FILE)
	# Own session so exiting Make does not kill Vite
	setsid -f sh -c 'cd "$(CURDIR)/$(APP_DIR)" && exec npm run dev -- --host $(HOST) --port $(PORT)' \
		> "$(CURDIR)/$(LOG_FILE)" 2>&1
	for i in $$(seq 1 20); do
		if curl -sf -o /dev/null "$(URL)"; then
			pid=$$(ss -tlnp 2>/dev/null | sed -n 's/.*:$(PORT).*pid=\([0-9]*\).*/\1/p' | head -1)
			if [[ -z "$$pid" ]]; then
				pid=$$(pgrep -nf "vite.*--port $(PORT)" || true)
			fi
			[[ -n "$$pid" ]] && echo "$$pid" > $(PID_FILE)
			echo "Started$${pid:+ (pid $$pid)} → $(URL)"
			echo "Logs: $(LOG_FILE)"
			exit 0
		fi
		sleep 0.25
	done
	echo "Failed to start — see $(LOG_FILE)"
	tail -n 40 $(LOG_FILE) || true
	exit 1

stop:
	@set +e
	stopped=0
	if [[ -f $(PID_FILE) ]]; then
		pid=$$(cat $(PID_FILE))
		if [[ -n "$$pid" ]] && kill -0 "$$pid" 2>/dev/null; then
			# Kill the vite/node listener; avoid broad pkill patterns
			kill "$$pid" 2>/dev/null || true
			stopped=1
			echo "Stopped pid $$pid"
		fi
		rm -f $(PID_FILE)
	fi
	# Fallback: whatever still holds the port
	pid=$$(ss -tlnp 2>/dev/null | sed -n 's/.*:$(PORT).*pid=\([0-9]*\).*/\1/p' | head -1)
	if [[ -n "$$pid" ]]; then
		kill "$$pid" 2>/dev/null || true
		stopped=1
		echo "Stopped port $(PORT) pid $$pid"
	fi
	sleep 0.2
	if curl -sf -o /dev/null "$(URL)"; then
		echo "Server still answering on $(PORT) — try: fuser -k $(PORT)/tcp"
		exit 1
	fi
	if [[ "$$stopped" != "1" ]]; then
		echo "Not running"
	fi

restart: stop start

status:
	@if curl -sf -o /dev/null "$(URL)"; then
		pid=$$(ss -tlnp 2>/dev/null | sed -n 's/.*:$(PORT).*pid=\([0-9]*\).*/\1/p' | head -1)
		echo "Running$${pid:+ (pid $$pid)} → $(URL)"
	else
		echo "Not running"
		[[ -f $(PID_FILE) ]] && rm -f $(PID_FILE) || true
	fi

build: install
	cd $(APP_DIR) && npm run build

preview: build
	cd $(APP_DIR) && npm run preview -- --host $(HOST) --port $(PORT)

clean: stop
	rm -rf $(APP_DIR)/dist $(LOG_FILE) $(PID_FILE)
