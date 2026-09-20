import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "./App";

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => ({
    setTransform: () => {},
    clearRect: () => {},
    save: () => {},
    translate: () => {},
    rotate: () => {},
    fillText: () => {},
    restore: () => {},
  });
});

test("renders AdMaya navbar brand and main sections", () => {
  render(<App />);
  const brandElements = screen.getAllByText(/AdMaya/i);
  expect(brandElements.length).toBeGreaterThan(0);

  const templatesHeading = screen.getByText(/Curated UGC & Product Ad Templates/i);
  expect(templatesHeading).toBeInTheDocument();

  const repoHeading = screen.getByText(/24-Hour Ad Repository/i);
  expect(repoHeading).toBeInTheDocument();

  const studioHeading = screen.getByText(/Write Your Script & Synthesize Video Ad/i);
  expect(studioHeading).toBeInTheDocument();
});
