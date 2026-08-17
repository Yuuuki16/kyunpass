import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ScoreBadge } from "./ScoreBadge";

test("表示されるスコアがそのまま描画される", () => {
  render(<ScoreBadge score={72} />);
  expect(screen.getByText("キュン度 72")).toBeInTheDocument();
});
