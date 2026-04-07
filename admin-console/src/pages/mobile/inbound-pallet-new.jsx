import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { buildFlightWaybills, getInboundFlight, PalletCreatePanel, useInboundStorage } from 'pages/mobile/inbound-shared';

export default function MobileInboundPalletNewPage() {
  const navigate = useNavigate();
  const { flightNo } = useParams();
  const flight = getInboundFlight(flightNo);
  const { pallets, setPallets } = useInboundStorage();

  if (!flight) {
    return <Navigate to="/mobile/inbound" replace />;
  }

  const waybills = buildFlightWaybills(flight.flightNo);

  return (
    <PalletCreatePanel
      flightNo={flight.flightNo}
      waybills={waybills}
      pallets={pallets}
      setPallets={setPallets}
      onCompleted={() => navigate(`/mobile/inbound/${flight.flightNo}/pallet`, { replace: true })}
    />
  );
}
