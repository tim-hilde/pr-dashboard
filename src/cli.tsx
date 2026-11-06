import React from "react";
import { render } from "ink";
import { App } from "./app";

render(<App />, { exitOnCtrlC: false, incrementalRendering: true });
