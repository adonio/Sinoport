import { Navigate, useParams } from 'react-router-dom';

import { getMobileNodeDetail } from 'data/sinoport-adapters';
import { MobileNodeDetailPage } from 'pages/mobile/node-shared';

export default function MobileExportRampDetailPage() {
  const { flightNo } = useParams();
  if (!getMobileNodeDetail('exportRamp', flightNo)) {
    return <Navigate to="/mobile/export-ramp" replace />;
  }
  return <MobileNodeDetailPage flowKey="exportRamp" itemId={flightNo} backPath="/mobile/export-ramp" />;
}
