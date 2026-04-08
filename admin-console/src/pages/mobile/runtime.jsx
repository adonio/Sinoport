import { MobileNodeListPage } from 'pages/mobile/node-shared';

export default function MobileRuntimePage() {
  return <MobileNodeListPage flowKey="flightRuntime" pathOf={(id) => `/mobile/runtime/${id}`} />;
}
