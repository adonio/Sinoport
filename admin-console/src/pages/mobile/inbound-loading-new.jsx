import { Navigate, useParams } from 'react-router-dom';

import { getInboundFlight } from 'pages/mobile/inbound-shared';

export default function MobileInboundLoadingNewPage() {
  const { flightNo } = useParams();
  const flight = getInboundFlight(flightNo);

  if (!flight) {
    return <Navigate to="/mobile/inbound" replace />;
  }

  return <Navigate to={`/mobile/inbound/${flight.flightNo}/loading`} replace />;
}
