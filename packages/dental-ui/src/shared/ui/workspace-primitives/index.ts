/* One import path for every primitive: `import { Table, Td, Field } from "./ui"`.
   Views should never reach into ui.module.css directly — if a view needs a style the
   primitives do not expose, the primitive is missing something. */

export {
  Table,
  TableWrap,
  Th,
  Td,
  Tr,
  RowActions,
  TableFooter,
  Pagination,
} from "./Table";

export { DataTable } from "./DataTable";
export type { Column } from "./DataTable";

export { Field, Input, Select, Textarea, InlineCheck } from "./Field";

export {
  Page,
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Toolbar,
  SearchBox,
} from "./Layout";

export {
  Modal,
  ModalBody,
  ModalError,
  FieldPair,
} from "./Modal";
export {
  handleSandboxedFormSubmitClick,
  handleSandboxedFormSubmitKeyDown,
} from "./sandboxedFormSubmit";

export { Drawer, Tabs } from "./Drawer";
export type { TabDef } from "./Drawer";

export { StatTile, TileGrid } from "./StatTile";

export { StackCell } from "./StackCell";

export { Chip, LoadingState, ErrorState, EmptyState } from "./Feedback";
export type { ChipTone } from "./Feedback";
