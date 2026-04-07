import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { buildFlightWaybills, getInboundFlight, LoadingPlanCreatePanel, useInboundLoadingStorage, useInboundStorage } from 'pages/mobile/inbound-shared';

export default function MobileInboundLoadingNewPage() {
  const navigate = useNavigate();
  const { flightNo } = useParams();
  const flight = getInboundFlight(flightNo);
  const { setLoadingPlans } = useInboundLoadingStorage();
  const { taskMap } = useInboundStorage();

  if (!flight) {
    return <Navigate to="/mobile/inbound" replace />;
  }

  const waybills = buildFlightWaybills(flight.flightNo);

  return (
    <LoadingPlanCreatePanel
      flightNo={flight.flightNo}
      waybills={waybills}
      taskMap={taskMap}
      onStart={(plan) => {
        setLoadingPlans((prev) => [plan, ...prev]);
        navigate(`/mobile/inbound/${flight.flightNo}/loading`, { replace: true });
      }}
    />
  );
}
