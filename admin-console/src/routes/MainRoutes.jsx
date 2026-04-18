import { lazy } from 'react';

import Loadable from 'components/Loadable';
import DashboardLayout from 'layout/Dashboard';

const PlatformStationsPage = Loadable(lazy(() => import('pages/platform/stations')));
const PlatformStationsCapabilitiesPage = Loadable(lazy(() => import('pages/platform/stations-capabilities')));
const PlatformStationDetailPage = Loadable(lazy(() => import('pages/platform/station-detail')));
const PlatformStationsTeamsPage = Loadable(lazy(() => import('pages/platform/stations-teams')));
const PlatformStationsZonesPage = Loadable(lazy(() => import('pages/platform/stations-zones')));
const PlatformStationsDevicesPage = Loadable(lazy(() => import('pages/platform/stations-devices')));
const PlatformOperationsPage = Loadable(lazy(() => import('pages/platform/operations')));
const PlatformNetworkPage = Loadable(lazy(() => import('pages/platform/network')));
const PlatformNetworkLanesPage = Loadable(lazy(() => import('pages/platform/network-lanes')));
const PlatformNetworkScenariosPage = Loadable(lazy(() => import('pages/platform/network-scenarios')));
const PlatformRulesPage = Loadable(lazy(() => import('pages/platform/rules')));
const PlatformMasterDataPage = Loadable(lazy(() => import('pages/platform/master-data')));
const PlatformMasterDataSyncPage = Loadable(lazy(() => import('pages/platform/master-data-sync')));
const PlatformMasterDataJobsPage = Loadable(lazy(() => import('pages/platform/master-data-jobs')));
const PlatformMasterDataRelationshipsPage = Loadable(lazy(() => import('pages/platform/master-data-relationships')));
const PlatformAuditPage = Loadable(lazy(() => import('pages/platform/audit')));
const PlatformAuditEventsPage = Loadable(lazy(() => import('pages/platform/audit-events')));
const PlatformAuditTrustPage = Loadable(lazy(() => import('pages/platform/audit-trust')));
const PlatformReportsPage = Loadable(lazy(() => import('pages/platform/reports')));
const PlatformReportStationsPage = Loadable(lazy(() => import('pages/platform/report-stations')));

const StationDashboardPage = Loadable(lazy(() => import('pages/station/dashboard')));
const StationInboundPage = Loadable(lazy(() => import('pages/station/inbound')));
const StationInboundMobilePage = Loadable(lazy(() => import('pages/station/inbound-mobile')));
const StationInboundFlightsPage = Loadable(lazy(() => import('pages/station/inbound-flights')));
const StationInboundFlightDetailPage = Loadable(lazy(() => import('pages/station/inbound-flight-detail')));
const StationInboundFlightCreatePage = Loadable(lazy(() => import('pages/station/inbound-flight-create')));
const StationInboundWaybillsPage = Loadable(lazy(() => import('pages/station/inbound-waybills')));
const StationInboundWaybillDetailPage = Loadable(lazy(() => import('pages/station/inbound-waybill-detail')));
const StationOutboundPage = Loadable(lazy(() => import('pages/station/outbound')));
const StationOutboundFlightsPage = Loadable(lazy(() => import('pages/station/outbound-flights')));
const StationOutboundFlightDetailPage = Loadable(lazy(() => import('pages/station/outbound-flight-detail')));
const StationOutboundWaybillsPage = Loadable(lazy(() => import('pages/station/outbound-waybills')));
const StationOutboundWaybillDetailPage = Loadable(lazy(() => import('pages/station/outbound-waybill-detail')));
const StationDocumentsPage = Loadable(lazy(() => import('pages/station/documents')));
const StationShipmentsPage = Loadable(lazy(() => import('pages/station/shipments')));
const StationShipmentDetailPage = Loadable(lazy(() => import('pages/station/shipment-detail')));
const StationTasksPage = Loadable(lazy(() => import('pages/station/tasks')));
const StationResourcesPage = Loadable(lazy(() => import('pages/station/resources')));
const StationResourcesTeamsPage = Loadable(lazy(() => import('pages/station/resources-teams')));
const StationResourcesZonesPage = Loadable(lazy(() => import('pages/station/resources-zones')));
const StationResourcesDevicesPage = Loadable(lazy(() => import('pages/station/resources-devices')));
const StationResourcesVehiclesPage = Loadable(lazy(() => import('pages/station/resources-vehicles')));
const StationExceptionsPage = Loadable(lazy(() => import('pages/station/exceptions')));
const StationExceptionDetailPage = Loadable(lazy(() => import('pages/station/exception-detail')));
const StationReportsPage = Loadable(lazy(() => import('pages/station/reports')));
const StationReportsShiftPage = Loadable(lazy(() => import('pages/station/reports-shift')));
const StationDocumentsNoaPage = Loadable(lazy(() => import('pages/station/documents-noa')));
const StationDocumentsPodPage = Loadable(lazy(() => import('pages/station/documents-pod')));
const StationCopilotPage = Loadable(lazy(() => import('pages/station/copilot')));

const MainRoutes = {
  path: '/',
  children: [
    {
      path: '/',
      element: <DashboardLayout />,
      children: [
        {
          path: 'sample-page',
          element: <PlatformStationsPage />
        },
        {
          path: 'platform',
          children: [
            {
              path: 'operations',
              element: <PlatformOperationsPage />
            },
            {
              path: 'stations',
              element: <PlatformStationsPage />
            },
            {
              path: 'stations/capabilities',
              element: <PlatformStationsCapabilitiesPage />
            },
            {
              path: 'stations/:stationCode',
              element: <PlatformStationDetailPage />
            },
            {
              path: 'stations/teams',
              element: <PlatformStationsTeamsPage />
            },
            {
              path: 'stations/zones',
              element: <PlatformStationsZonesPage />
            },
            {
              path: 'stations/devices',
              element: <PlatformStationsDevicesPage />
            },
            {
              path: 'network',
              element: <PlatformNetworkPage />
            },
            {
              path: 'network/lanes',
              element: <PlatformNetworkLanesPage />
            },
            {
              path: 'network/scenarios',
              element: <PlatformNetworkScenariosPage />
            },
            {
              path: 'rules',
              element: <PlatformRulesPage />
            },
            {
              path: 'master-data',
              element: <PlatformMasterDataPage />
            },
            {
              path: 'master-data/sync',
              element: <PlatformMasterDataSyncPage />
            },
            {
              path: 'master-data/jobs',
              element: <PlatformMasterDataJobsPage />
            },
            {
              path: 'master-data/relationships',
              element: <PlatformMasterDataRelationshipsPage />
            },
            {
              path: 'audit',
              element: <PlatformAuditPage />
            },
            {
              path: 'audit/events',
              element: <PlatformAuditEventsPage />
            },
            {
              path: 'audit/trust',
              element: <PlatformAuditTrustPage />
            },
            {
              path: 'reports',
              element: <PlatformReportsPage />
            },
            {
              path: 'reports/stations',
              element: <PlatformReportStationsPage />
            }
          ]
        },
        {
          path: 'station',
          children: [
            {
              path: 'dashboard',
              element: <StationDashboardPage />
            },
            {
              path: 'inbound',
              children: [
                {
                  index: true,
                  element: <StationInboundPage />
                },
                {
                  path: 'mobile',
                  element: <StationInboundMobilePage />
                },
                {
                  path: 'flights',
                  element: <StationInboundFlightsPage />
                },
                {
                  path: 'flights/new',
                  element: <StationInboundFlightCreatePage />
                },
                {
                  path: 'flights/:flightNo',
                  element: <StationInboundFlightDetailPage />
                },
                {
                  path: 'waybills',
                  element: <StationInboundWaybillsPage />
                },
                {
                  path: 'waybills/:awb',
                  element: <StationInboundWaybillDetailPage />
                }
              ]
            },
            {
              path: 'outbound',
              children: [
                {
                  index: true,
                  element: <StationOutboundPage />
                },
                {
                  path: 'flights',
                  element: <StationOutboundFlightsPage />
                },
                {
                  path: 'flights/:flightNo',
                  element: <StationOutboundFlightDetailPage />
                },
                {
                  path: 'waybills',
                  element: <StationOutboundWaybillsPage />
                },
                {
                  path: 'waybills/:awb',
                  element: <StationOutboundWaybillDetailPage />
                }
              ]
            },
            {
              path: 'shipments',
              children: [
                {
                  index: true,
                  element: <StationShipmentsPage />
                },
                {
                  path: ':shipmentId',
                  element: <StationShipmentDetailPage />
                }
              ]
            },
            {
              path: 'documents',
              element: <StationDocumentsPage />
            },
            {
              path: 'documents/noa',
              element: <StationDocumentsNoaPage />
            },
            {
              path: 'documents/pod',
              element: <StationDocumentsPodPage />
            },
            {
              path: 'files',
              element: <StationDocumentsPage />
            },
            {
              path: 'copilot',
              element: <StationCopilotPage />
            },
            {
              path: 'tasks',
              element: <StationTasksPage />
            },
            {
              path: 'resources',
              element: <StationResourcesPage />
            },
            {
              path: 'resources/teams',
              element: <StationResourcesTeamsPage />
            },
            {
              path: 'resources/zones',
              element: <StationResourcesZonesPage />
            },
            {
              path: 'resources/devices',
              element: <StationResourcesDevicesPage />
            },
            {
              path: 'resources/vehicles',
              element: <StationResourcesVehiclesPage />
            },
            {
              path: 'exceptions',
              element: <StationExceptionsPage />
            },
            {
              path: 'exceptions/:exceptionId',
              element: <StationExceptionDetailPage />
            },
            {
              path: 'reports',
              element: <StationReportsPage />
            },
            {
              path: 'reports/shift',
              element: <StationReportsShiftPage />
            }
          ]
        }
      ]
    }
  ]
};

export default MainRoutes;
