import {
  SVG_DIAGRAM_PRIMITIVES_V0_1,
  SVG_NS,
  appendGrid,
  createOpenArrowMarker,
  svgNode,
} from "./common/diagram/svg-primitives-v0.1.mjs?v=d12b3a73a417";
import {
  SVG_PNG_EXPORT_V0_1,
  saveSvgAsPng,
} from "./common/diagram/svg-png-export-v0.1.mjs?v=d12b3a73a417";

window.BDPCommonDiagram = Object.freeze({
  primitivesModel: SVG_DIAGRAM_PRIMITIVES_V0_1,
  pngExportModel: SVG_PNG_EXPORT_V0_1,
  SVG_NS,
  appendGrid,
  createOpenArrowMarker,
  saveSvgAsPng,
  svgNode,
});

await import("./bdp-graph-renderers.js?v=d12b3a73a417");
await import("./bdp-ui-adapter.js?v=d12b3a73a417");
await import("./bdp-v2-core.js?v=d12b3a73a417");
await import("./bdp-v2-provider.js?v=d12b3a73a417");
