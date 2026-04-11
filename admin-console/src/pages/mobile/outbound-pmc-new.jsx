import { Navigate, useParams } from 'react-router-dom';

import { getOutboundFlight } from 'pages/mobile/outbound-shared';

export default function MobileOutboundPmcNewPage() {
  const { flightNo } = useParams();
  const flight = getOutboundFlight(flightNo);

  if (!flight) {
    return <Navigate to="/mobile/outbound" replace />;
  }

  return <Navigate to={`/mobile/outbound/${flight.flightNo}/pmc`} replace />;
}
