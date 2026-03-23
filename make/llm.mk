UV ?= uv
VENV_DIR ?= .venv
VENV_PYTHON ?= $(VENV_DIR)/bin/python
VLLM_HOST ?= 0.0.0.0
VLLM_PORT ?= 8000
VLLM_MLX_MODEL ?= Qwen/Qwen3-14B-MLX-4bit
VLLM_API_BASE ?= http://127.0.0.1:$(VLLM_PORT)
VLLM_RUNTIME_DIR ?= var/llm
VLLM_PID_FILE ?= $(VLLM_RUNTIME_DIR)/vllm-mlx.pid
VLLM_LOG_FILE ?= $(VLLM_RUNTIME_DIR)/vllm-mlx.log
VLLM_STATUS_URL ?= $(VLLM_API_BASE)/v1/status
LLM_SCRIPT = sh ./scripts/llm.sh
LLM_SCRIPT_ENV = \
	UV=$(UV) \
	VENV_DIR=$(VENV_DIR) \
	VENV_PYTHON=$(VENV_PYTHON) \
	VLLM_HOST=$(VLLM_HOST) \
	VLLM_PORT=$(VLLM_PORT) \
	VLLM_MLX_MODEL='$(VLLM_MLX_MODEL)' \
	VLLM_API_BASE=$(VLLM_API_BASE) \
	VLLM_RUNTIME_DIR=$(VLLM_RUNTIME_DIR) \
	VLLM_PID_FILE=$(VLLM_PID_FILE) \
	VLLM_LOG_FILE=$(VLLM_LOG_FILE) \
	VLLM_STATUS_URL=$(VLLM_STATUS_URL) \
	ENV_FILE=$(ENV_FILE) \
	ENV_FILE_PLACEHOLDER=$(ENV_FILE_PLACEHOLDER) \
	LLM_API_KEY='$(LLM_API_KEY)'

.PHONY: \
	venv \
	llm-install \
	llm-serve \
	llm-serve-bg \
	llm-smoke \
	llm-status \
	llm-stop \
	llm-logs

venv:
	@if [ ! -d "$(VENV_DIR)" ]; then \
		$(UV) venv $(VENV_DIR); \
	fi

llm-install: venv
	$(UV) sync --python $(VENV_PYTHON)

llm-serve: venv
	$(LLM_SCRIPT_ENV) $(LLM_SCRIPT) serve

llm-serve-bg: venv
	$(LLM_SCRIPT_ENV) $(LLM_SCRIPT) serve-bg

llm-smoke:
	$(LLM_SCRIPT_ENV) $(LLM_SCRIPT) smoke

llm-status:
	$(LLM_SCRIPT_ENV) $(LLM_SCRIPT) status

llm-stop:
	$(LLM_SCRIPT_ENV) $(LLM_SCRIPT) stop

llm-logs:
	$(LLM_SCRIPT_ENV) $(LLM_SCRIPT) logs
