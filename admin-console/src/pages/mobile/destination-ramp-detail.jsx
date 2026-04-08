import { Navigate, useParams } from 'react-router-dom';

import { getMobileNodeDetail } from 'data/sinoport-adapters';
import { MobileNodeDetailPage } from 'pages/mobile/node-shared';

export default function MobileDestinationRampDetailPage() {
  const { flightNo } = useParams();
  if (!getMobileNodeDetail('destinationRamp', flightNo)) {
    return <Navigate to="/mobile/destination-ramp" replace />;
  }
  return <MobileNodeDetailPage flowKey="destinationRamp" itemId={flightNo} backPath="/mobile/destination-ramp" />;
}
