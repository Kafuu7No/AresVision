import csv
import re
from pathlib import Path

import torch


MODEL_TYPE_BY_KEY = {
    "convlstm": "时空模型",
    "earthformer": "时空模型",
    "mau": "时空模型",
    "predrnnpp": "时空模型",
    "predrnnv2": "时空模型",
    "simvp": "时空模型",
}


def get_model_type(model_name):
    return MODEL_TYPE_BY_KEY.get(normalize_model_name(model_name), "纯时间序列")


def load_state_dict(path):
    state = torch.load(path, map_location="cpu")
    if isinstance(state, dict) and "state_dict" in state:
        state = state["state_dict"]
    return state


def classify_phase_param(param_name):
    leaf_name = param_name.split(".")[-1]
    prefix = leaf_name[0].lower()
    if prefix == "w":
        return "W"
    if prefix == "b":
        return "B"
    if prefix == "k":
        return "K"
    return None


def tensor_to_effective_values(param_type, tensor):
    values = tensor.detach().cpu().reshape(-1).float()
    if param_type == "K":
        values = torch.tanh(values)
    return values


def summarize_values(values):
    return {
        "min": float(values.min().item()),
        "mean": float(values.mean().item()),
        "abs_mean": float(values.abs().mean().item()),
        "max": float(values.max().item()),
    }


def is_non_trainable_buffer_key(param_name):
    buffer_suffixes = (
        "running_mean",
        "running_var",
        "num_batches_tracked",
    )
    return any(param_name.endswith(suffix) for suffix in buffer_suffixes)


def count_model_parameters(state):
    total_params = 0
    for param_name, tensor in state.items():
        if is_non_trainable_buffer_key(param_name):
            continue
        if not hasattr(tensor, "numel"):
            continue
        total_params += int(tensor.numel())
    return total_params


def normalize_model_name(name):
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def find_child_dir(parent_dir, file_pattern):
    for child in parent_dir.iterdir():
        if child.is_dir() and any(child.glob(file_pattern)):
            return child
    raise FileNotFoundError(
        f"Could not find a child directory under {parent_dir} with pattern {file_pattern}"
    )


def parse_compare_metrics(log_dir):
    metrics_by_model = {}
    raw_pattern = re.compile(
        r"^(?P<model>.+?)_Raw Metrics \| RMSE: (?P<rmse>[-0-9.]+) "
        r"\| MAE: (?P<mae>[-0-9.]+) \| R\^2: (?P<r2>[-0-9.]+) \| SMAPE: (?P<smape>[-0-9.]+)%$"
    )
    phase_pattern = re.compile(
        r"^(?P<model>.+?)_PhaseWarp Metrics \| RMSE: (?P<rmse>[-0-9.]+) "
        r"\| MAE: (?P<mae>[-0-9.]+) \| R\^2: (?P<r2>[-0-9.]+) \| SMAPE: (?P<smape>[-0-9.]+)%$"
    )

    for log_path in sorted(log_dir.glob("*.txt")):
        text = log_path.read_text(encoding="utf-8", errors="ignore")
        for raw_line in text.splitlines():
            line = raw_line.strip()
            raw_match = raw_pattern.match(line)
            if raw_match:
                model_key = normalize_model_name(raw_match.group("model"))
                model_metrics = metrics_by_model.setdefault(model_key, {"metrics_log_file": log_path.name})
                model_metrics["raw_rmse"] = float(raw_match.group("rmse"))
                model_metrics["raw_r2"] = float(raw_match.group("r2"))
                model_metrics["raw_smape"] = float(raw_match.group("smape"))
                continue

            phase_match = phase_pattern.match(line)
            if phase_match:
                model_key = normalize_model_name(phase_match.group("model"))
                model_metrics = metrics_by_model.setdefault(model_key, {"metrics_log_file": log_path.name})
                model_metrics["phase_rmse"] = float(phase_match.group("rmse"))
                model_metrics["phase_r2"] = float(phase_match.group("r2"))
                model_metrics["phase_smape"] = float(phase_match.group("smape"))

    improvement_by_model = {}
    for model_key, values in metrics_by_model.items():
        if not all(key in values for key in ("raw_rmse", "phase_rmse", "raw_r2", "phase_r2", "raw_smape", "phase_smape")):
            continue
        r2_gain = values["phase_r2"] - values["raw_r2"]
        raw_unexplained = 1.0 - values["raw_r2"]
        r2_error_reduction_rate = r2_gain / raw_unexplained if raw_unexplained != 0 else None
        improvement_by_model[model_key] = {
            "RMSE_improve": values["raw_rmse"] - values["phase_rmse"],
            "MSE_improve": (values["raw_rmse"] ** 2) - (values["phase_rmse"] ** 2),
            "R2_gain": r2_gain,
            "R2_error_reduction_rate": r2_error_reduction_rate,
            "SMAPE_improve": values["raw_smape"] - values["phase_smape"],
            "metrics_log_file": values["metrics_log_file"],
        }

    return improvement_by_model


def assign_ranks(rows, metric_key, rank_key, reverse):
    available_rows = [row for row in rows if row.get(metric_key) is not None]
    ordered_rows = sorted(available_rows, key=lambda row: row[metric_key], reverse=reverse)
    for rank_idx, row in enumerate(ordered_rows, start=1):
        row[rank_key] = rank_idx


def markdown_table(rows, columns):
    if not rows:
        return "_No data_\n"

    headers = [label for _, label in columns]
    widths = [len(header) for header in headers]
    for row in rows:
        for idx, (key, _) in enumerate(columns):
            value = row.get(key, "")
            if value is None:
                text = ""
            elif isinstance(value, float):
                text = f"{value:.6f}"
            else:
                text = str(value)
            widths[idx] = max(widths[idx], len(text))

    def format_row(items):
        return "| " + " | ".join(str(item).ljust(width) for item, width in zip(items, widths)) + " |"

    header_row = format_row(headers)
    divider_row = "| " + " | ".join("-" * width for width in widths) + " |"
    body_rows = []
    for row in rows:
        rendered = []
        for key, _ in columns:
            value = row.get(key, "")
            if value is None:
                rendered.append("")
            elif isinstance(value, float):
                rendered.append(f"{value:.6f}")
            else:
                rendered.append(str(value))
        body_rows.append(format_row(rendered))
    return "\n".join([header_row, divider_row, *body_rows]) + "\n"


def main():
    current_dir = Path(__file__).resolve().parent
    experiment_dir = current_dir.parent
    result_dir = find_child_dir(experiment_dir, "*_phasewarp.pth")
    log_dir = find_child_dir(experiment_dir, "*PhaseWarp_Compare.txt")
    improvement_by_model = parse_compare_metrics(log_dir)

    rows = []
    for model_path in sorted(result_dir.glob("*_phasewarp.pth")):
        if model_path.name.endswith("_checkpoint.pth"):
            continue

        state = load_state_dict(model_path)
        grouped_values = {"W": [], "B": [], "K": []}

        for param_name, tensor in state.items():
            if "phase_warp." not in param_name:
                continue
            param_type = classify_phase_param(param_name)
            if param_type is None:
                continue
            grouped_values[param_type].append(tensor_to_effective_values(param_type, tensor))

        if not all(grouped_values.values()):
            continue

        row = {
            "model_name": model_path.stem.replace("_phasewarp", ""),
            "weight_file": model_path.name,
            "total_params": count_model_parameters(state),
        }
        row["model_type"] = get_model_type(row["model_name"])
        row["total_params_million"] = row["total_params"] / 1_000_000.0
        for param_type in ("W", "B", "K"):
            values = torch.cat(grouped_values[param_type], dim=0)
            stats = summarize_values(values)
            row[f"{param_type}_min"] = stats["min"]
            row[f"{param_type}_mean"] = stats["mean"]
            row[f"{param_type}_abs_mean"] = stats["abs_mean"]
            row[f"{param_type}_max"] = stats["max"]

        improvement_metrics = improvement_by_model.get(normalize_model_name(row["model_name"]))
        if improvement_metrics:
            row.update(improvement_metrics)
        else:
            row.update(
                {
                    "RMSE_improve": None,
                    "MSE_improve": None,
                    "R2_gain": None,
                    "R2_error_reduction_rate": None,
                    "SMAPE_improve": None,
                    "metrics_log_file": "",
                }
            )
        rows.append(row)

    if not rows:
        raise FileNotFoundError(f"No phasewarp parameter tensors found in {result_dir}")

    rank_specs = [
        ("total_params", "param_count_rank", True),
        ("RMSE_improve", "RMSE_improve_rank", True),
        ("MSE_improve", "MSE_improve_rank", True),
        ("R2_gain", "R2_gain_rank", True),
        ("R2_error_reduction_rate", "R2_error_reduction_rate_rank", True),
        ("SMAPE_improve", "SMAPE_improve_rank", True),
        ("W_min", "W_min_rank", True),
        ("W_mean", "W_mean_rank", True),
        ("W_abs_mean", "W_abs_mean_rank", True),
        ("W_max", "W_max_rank", True),
        ("B_min", "B_min_rank", True),
        ("B_mean", "B_mean_rank", True),
        ("B_abs_mean", "B_abs_mean_rank", True),
        ("B_max", "B_max_rank", True),
        ("K_min", "K_min_rank", True),
        ("K_mean", "K_mean_rank", True),
        ("K_abs_mean", "K_abs_mean_rank", True),
        ("K_max", "K_max_rank", True),
    ]
    for metric_key, rank_key, reverse in rank_specs:
        assign_ranks(rows, metric_key, rank_key, reverse=reverse)

    sorted_rows = sorted(
        rows,
        key=lambda row: (
            row.get("R2_gain_rank") is None,
            row.get("R2_gain_rank", 10**9),
        ),
    )
    sorted_rows_by_params = sorted(
        rows,
        key=lambda row: (
            row.get("param_count_rank") is None,
            row.get("param_count_rank", 10**9),
        ),
    )

    csv_path = result_dir / "phasewarp_param_summary_table.csv"
    md_path = result_dir / "phasewarp_param_summary_table.md"
    csv_by_params_path = result_dir / "phasewarp_param_summary_table_by_params.csv"
    md_by_params_path = result_dir / "phasewarp_param_summary_table_by_params.md"

    fieldnames = [
        "model_name",
        "model_type",
        "weight_file",
        "total_params",
        "total_params_million",
        "param_count_rank",
        "RMSE_improve",
        "RMSE_improve_rank",
        "MSE_improve",
        "MSE_improve_rank",
        "R2_gain",
        "R2_gain_rank",
        "R2_error_reduction_rate",
        "R2_error_reduction_rate_rank",
        "SMAPE_improve",
        "SMAPE_improve_rank",
        "W_min",
        "W_min_rank",
        "W_mean",
        "W_mean_rank",
        "W_abs_mean",
        "W_abs_mean_rank",
        "W_max",
        "W_max_rank",
        "B_min",
        "B_min_rank",
        "B_mean",
        "B_mean_rank",
        "B_abs_mean",
        "B_abs_mean_rank",
        "B_max",
        "B_max_rank",
        "K_min",
        "K_min_rank",
        "K_mean",
        "K_mean_rank",
        "K_abs_mean",
        "K_abs_mean_rank",
        "K_max",
        "K_max_rank",
        "metrics_log_file",
    ]
    with csv_path.open("w", newline="", encoding="utf-8") as fp:
        writer = csv.DictWriter(fp, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(sorted_rows)
    with csv_by_params_path.open("w", newline="", encoding="utf-8") as fp:
        writer = csv.DictWriter(fp, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(sorted_rows_by_params)

    md_lines = [
        "# PhaseWarp Parameter Summary",
        "",
        "K uses the effective value after tanh(k), because that is what the model actually applies in forward().",
        "Improvement metrics are computed as PhaseWarp relative to Raw: RMSE/MSE/SMAPE use Raw - PhaseWarp, and R2 uses PhaseWarp - Raw.",
        "R2_error_reduction_rate is R2_gain / (1 - Raw_R2), the relative reduction in unexplained variance.",
        "Ranking rule: larger improvement is better, so RMSE_improve/MSE_improve/R2_gain/R2_error_reduction_rate/SMAPE_improve all use descending rank.",
        "Row order in this file is sorted by R2_gain_rank (largest R^2 gain first).",
        "",
        markdown_table(
            sorted_rows,
            [
                ("model_name", "Model"),
                ("model_type", "Model_Type"),
                ("total_params", "Total_Params"),
                ("total_params_million", "Params_M"),
                ("param_count_rank", "Param_Rank"),
            ],
        ),
        "",
        markdown_table(
            sorted_rows,
            [
                ("model_name", "Model"),
                ("model_type", "Model_Type"),
                ("RMSE_improve", "RMSE_Improve"),
                ("RMSE_improve_rank", "RMSE_Improve_Rank"),
                ("MSE_improve", "MSE_Improve"),
                ("MSE_improve_rank", "MSE_Improve_Rank"),
                ("R2_gain", "R2_Gain"),
                ("R2_gain_rank", "R2_Gain_Rank"),
                ("R2_error_reduction_rate", "R2_Error_Reduction_Rate"),
                ("R2_error_reduction_rate_rank", "R2_Error_Reduction_Rate_Rank"),
                ("SMAPE_improve", "SMAPE_Improve"),
                ("SMAPE_improve_rank", "SMAPE_Improve_Rank"),
            ],
        ),
        "",
        markdown_table(
            sorted_rows,
            [
                ("model_name", "Model"),
                ("model_type", "Model_Type"),
                ("W_min", "W_min"),
                ("W_min_rank", "W_min_Rank"),
                ("W_mean", "W_mean"),
                ("W_mean_rank", "W_mean_Rank"),
                ("W_abs_mean", "|W|_mean"),
                ("W_abs_mean_rank", "|W|_mean_Rank"),
                ("W_max", "W_max"),
                ("W_max_rank", "W_max_Rank"),
                ("B_min", "B_min"),
                ("B_min_rank", "B_min_Rank"),
                ("B_mean", "B_mean"),
                ("B_mean_rank", "B_mean_Rank"),
                ("B_abs_mean", "|B|_mean"),
                ("B_abs_mean_rank", "|B|_mean_Rank"),
                ("B_max", "B_max"),
                ("B_max_rank", "B_max_Rank"),
                ("K_min", "K_min"),
                ("K_min_rank", "K_min_Rank"),
                ("K_mean", "K_mean"),
                ("K_mean_rank", "K_mean_Rank"),
                ("K_abs_mean", "|K|_mean"),
                ("K_abs_mean_rank", "|K|_mean_Rank"),
                ("K_max", "K_max"),
                ("K_max_rank", "K_max_Rank"),
            ],
        ),
    ]
    md_path.write_text("\n".join(md_lines), encoding="utf-8")

    md_by_params_lines = [
        "# PhaseWarp Parameter Summary By Parameter Count",
        "",
        "Parameter count is estimated from model state_dict tensors, excluding standard BatchNorm running statistics buffers.",
        "Row order in this file is sorted by param_count_rank (largest model first).",
        "",
        markdown_table(
            sorted_rows_by_params,
            [
                ("model_name", "Model"),
                ("model_type", "Model_Type"),
                ("total_params", "Total_Params"),
                ("total_params_million", "Params_M"),
                ("param_count_rank", "Param_Rank"),
                ("R2_gain", "R2_Gain"),
                ("R2_gain_rank", "R2_Gain_Rank"),
                ("R2_error_reduction_rate", "R2_Error_Reduction_Rate"),
                ("R2_error_reduction_rate_rank", "R2_Error_Reduction_Rate_Rank"),
                ("RMSE_improve", "RMSE_Improve"),
                ("RMSE_improve_rank", "RMSE_Improve_Rank"),
                ("SMAPE_improve", "SMAPE_Improve"),
                ("SMAPE_improve_rank", "SMAPE_Improve_Rank"),
            ],
        ),
        "",
        markdown_table(
            sorted_rows_by_params,
            [
                ("model_name", "Model"),
                ("model_type", "Model_Type"),
                ("W_mean", "W_mean"),
                ("W_abs_mean", "|W|_mean"),
                ("B_mean", "B_mean"),
                ("B_abs_mean", "|B|_mean"),
                ("K_mean", "K_mean"),
                ("K_abs_mean", "|K|_mean"),
                ("W_max", "W_max"),
                ("B_max", "B_max"),
                ("K_max", "K_max"),
            ],
        ),
    ]
    md_by_params_path.write_text("\n".join(md_by_params_lines), encoding="utf-8")

    print(f"Saved CSV table: {csv_path}")
    print(f"Saved Markdown table: {md_path}")
    print(f"Saved parameter-sorted CSV table: {csv_by_params_path}")
    print(f"Saved parameter-sorted Markdown table: {md_by_params_path}")


if __name__ == "__main__":
    main()
