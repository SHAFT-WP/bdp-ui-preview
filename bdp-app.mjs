import { installResultPanel } from "./common/ui/result-panel-v0.1.mjs?v=6b39385014b8";
import { installSvgLegend } from "./common/diagram/svg-legend-v0.1.mjs?v=6b39385014b8";
import {
  SVG_DIAGRAM_PRIMITIVES_V0_1,
  SVG_NS,
  appendGrid,
  createOpenArrowMarker,
  svgNode,
} from "./common/diagram/svg-primitives-v0.1.mjs?v=6b39385014b8";
import {
  SVG_PNG_EXPORT_V0_1,
  saveSvgAsPng,
} from "./common/diagram/svg-png-export-v0.1.mjs?v=6b39385014b8";

window.BDPCommonDiagram = Object.freeze({
  primitivesModel: SVG_DIAGRAM_PRIMITIVES_V0_1,
  pngExportModel: SVG_PNG_EXPORT_V0_1,
  SVG_NS,
  appendGrid,
  createOpenArrowMarker,
  saveSvgAsPng,
  svgNode,
});

window.BDPResultPanel = installResultPanel(document.querySelector('[data-result-panel]'));
installSvgLegend(document.getElementById('profile-legend'), [
  { label: 'Tracking', color: '#176dac' },
  { label: 'Bomb trajectory', color: '#087b4c' },
  { label: 'AoD', color: '#a35d00' },
  { label: 'MAP', color: '#d64b4b' },
]);
installSvgLegend(document.getElementById('top-legend'), [
  { label: 'Initial track', color: '#2f6fc2' },
  { label: 'Roll-in', color: '#c85ac8' },
  { label: 'MAP', color: '#d59400' },
  { label: 'Roll-in / Target', color: '#d64b4b' },
]);

await import("./bdp-graph-renderers.js?v=6b39385014b8");
await import("./bdp-top-view-visibility.js?v=6b39385014b8");
await import("./bdp-ui-adapter.js?v=6b39385014b8");
await import("./bdp-v2-core.js?v=6b39385014b8");
await import("./bdp-v2-provider.js?v=6b39385014b8");
