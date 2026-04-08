import { MobileNodeListPage } from 'pages/mobile/node-shared';

export default function MobileDestinationRampPage() {
  return <MobileNodeListPage flowKey="destinationRamp" pathOf={(id) => `/mobile/destination-ramp/${id}`} />;
}
