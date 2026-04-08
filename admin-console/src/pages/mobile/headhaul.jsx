import { MobileNodeListPage } from 'pages/mobile/node-shared';

export default function MobileHeadhaulPage() {
  return <MobileNodeListPage flowKey="headhaul" pathOf={(id) => `/mobile/headhaul/${id}`} />;
}
