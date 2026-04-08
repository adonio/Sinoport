import { MobileNodeListPage } from 'pages/mobile/node-shared';

export default function MobileExportRampPage() {
  return <MobileNodeListPage flowKey="exportRamp" pathOf={(id) => `/mobile/export-ramp/${id}`} />;
}
