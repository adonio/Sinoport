import { useParams } from 'react-router-dom';

import { MobileNodeDetailPage } from 'pages/mobile/node-shared';

export default function MobileExportRampDetailPage() {
  const { flightNo } = useParams();
  return <MobileNodeDetailPage flowKey="exportRamp" itemId={flightNo} backPath="/mobile/export-ramp" />;
}
