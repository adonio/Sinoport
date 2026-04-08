import { Navigate, useParams } from 'react-router-dom';

import { getMobileNodeDetail } from 'data/sinoport-adapters';
import { MobileNodeDetailPage } from 'pages/mobile/node-shared';

export default function MobileRuntimeDetailPage() {
  const { flightNo } = useParams();
  if (!getMobileNodeDetail('flightRuntime', flightNo)) {
    return <Navigate to="/mobile/runtime" replace />;
  }
  return <MobileNodeDetailPage flowKey="flightRuntime" itemId={flightNo} backPath="/mobile/runtime" />;
}
