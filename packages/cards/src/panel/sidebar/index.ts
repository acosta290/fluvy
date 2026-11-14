/*
 * A dashboard's sidebar in the panel (1.21, #187), the Dashboards tab's section that gives a dashboard its
 * `fluvy_sidebar:` without YAML: none, the ready-made *Clock and pages*, or one of the person's own. A file of its own,
 * fetched the first time someone opens it — the panel's other tabs never pay for it.
 */
export { SidebarEditor, type SidebarEditorHost } from './editor.js';
export { sidebarEditorStyles } from './styles.js';
