import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import {
  getDocumentVersions,
  getGateEvaluationsForDocument,
  getStationDocument,
  inboundDocumentGates,
  instructionTemplateRows,
  outboundDocumentGates,
  stationDocumentRows
} from 'data/sinoport-adapters';

function buildInitialVersionState() {
  return Object.fromEntries(stationDocumentRows.map((item) => [item.documentId, item.activeVersionId]));
}

function getVersionLabel(versions, versionId) {
  return versions.find((item) => item.versionId === versionId)?.version || versions.at(-1)?.version || '-';
}

export default function StationDocumentsPage() {
  const [selectedDocumentId, setSelectedDocumentId] = useState(stationDocumentRows[0]?.documentId || '');
  const [activeVersionByDoc, setActiveVersionByDoc] = useState(buildInitialVersionState);
  const [previewVersionId, setPreviewVersionId] = useState('');
  const [activityLog, setActivityLog] = useState([
    {
      id: 'DOC-ACT-001',
      title: 'Manifest 最终版待冻结',
      description: 'SE913 当前仍命中 HG-01，需冻结最终版后才能解除机坪放行阻断。',
      status: '警戒'
    }
  ]);

  const selectedDocument = getStationDocument(selectedDocumentId);
  const selectedVersions = useMemo(() => getDocumentVersions(selectedDocumentId), [selectedDocumentId]);
  const activeVersionId = activeVersionByDoc[selectedDocumentId] || selectedDocument?.activeVersionId;
  const activeVersion = selectedVersions.find((item) => item.versionId === activeVersionId) || selectedVersions.at(-1);
  const previewOpen = Boolean(previewVersionId);
  const previewVersion = selectedVersions.find((item) => item.versionId === previewVersionId) || activeVersion;
  const selectedGateItems = useMemo(
    () =>
      getGateEvaluationsForDocument(selectedDocumentId).map((item) => ({
        gateId: item.gateId,
        node: item.node,
        required: item.required,
        impact: item.impact,
        status: item.status,
        blocker: item.blockingReason,
        recovery: item.recoveryAction,
        releaseRole: item.releaseRole
      })),
    [selectedDocumentId]
  );

  const metrics = [
    { title: '文件台账', value: `${stationDocumentRows.length}`, helper: '统一回连 Flight / AWB / Truck / POD', chip: 'Documents', color: 'primary' },
    { title: '进港放行门槛', value: `${inboundDocumentGates.length}`, helper: '从 gate evaluation 统一映射', chip: 'Inbound', color: 'secondary' },
    { title: '出港放行门槛', value: `${outboundDocumentGates.length}`, helper: 'Loaded / Airborne 前必须校验', chip: 'Outbound', color: 'success' },
    { title: '指令模板', value: `${instructionTemplateRows.length}`, helper: '文件模板与任务模板绑定', chip: 'Templates', color: 'warning' }
  ];

  const rowsWithVersionState = stationDocumentRows.map((item) => {
    const versions = getDocumentVersions(item.documentId);
    const currentVersionId = activeVersionByDoc[item.documentId] || item.activeVersionId;
    const currentVersion = versions.find((entry) => entry.versionId === currentVersionId) || versions.at(-1);

    return {
      ...item,
      currentVersion
    };
  });

  function pushActivity(title, description, status) {
    setActivityLog((prev) => [
      {
        id: `DOC-ACT-${Date.now()}`,
        title,
        description,
        status
      },
      ...prev
    ].slice(0, 6));
  }

  function handlePreview(versionId = activeVersion?.versionId) {
    setPreviewVersionId(versionId);
  }

  function handleReplace() {
    const candidate =
      selectedVersions.find((item) => item.status === '待发布' && item.versionId !== activeVersion?.versionId) ||
      selectedVersions.at(-1);

    if (!candidate || candidate.versionId === activeVersion?.versionId) return;

    setActiveVersionByDoc((prev) => ({
      ...prev,
      [selectedDocumentId]: candidate.versionId
    }));
    pushActivity(
      `${selectedDocument.type} 替换为 ${candidate.version}`,
      `${selectedDocument.name} 已切换到待发布版本，当前页 mock 口径会据此展示最新差异摘要。`,
      '运行中'
    );
  }

  function handleRollback() {
    const rollbackVersionId =
      activeVersion?.rollbackTarget ||
      [...selectedVersions].reverse().find((item) => item.sortOrder < (activeVersion?.sortOrder || 0))?.versionId;

    if (!rollbackVersionId) return;

    setActiveVersionByDoc((prev) => ({
      ...prev,
      [selectedDocumentId]: rollbackVersionId
    }));
    pushActivity(
      `${selectedDocument.type} 回退到 ${getVersionLabel(selectedVersions, rollbackVersionId)}`,
      `${selectedDocument.name} 已回退到前一版，便于演示版本审计与恢复动作。`,
      '待处理'
    );
  }

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Documents & Instructions"
          title="单证与指令中心"
          description="文件不再只是台账，而是状态放行、任务生成和模板指令的前端演示主入口。当前页补齐版本侧栏、预览、替换、回退、对象绑定和 gate 结果。"
          chips={['Versioning', 'Preview', 'Rollback', 'Gate Control', 'Object Binding']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                查看作业任务
              </Button>
              <Button component={RouterLink} to="/station/documents/noa" variant="outlined">
                NOA
              </Button>
              <Button component={RouterLink} to="/station/documents/pod" variant="outlined">
                POD
              </Button>
            </Stack>
          }
        />
      </Grid>

      {metrics.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} />
        </Grid>
      ))}

      <Grid size={{ xs: 12, xl: 6 }}>
        <DocumentStatusCard title="进港文件放行" items={inboundDocumentGates} />
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <DocumentStatusCard title="出港文件放行" items={outboundDocumentGates} />
      </Grid>

      <Grid size={{ xs: 12, xl: 7 }}>
        <MainCard title="文件台账">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>类型</TableCell>
                <TableCell>文件名</TableCell>
                <TableCell>关联对象</TableCell>
                <TableCell>当前版本</TableCell>
                <TableCell>更新时间</TableCell>
                <TableCell>状态</TableCell>
                <TableCell align="right">跳转</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rowsWithVersionState.map((item) => (
                <TableRow
                  key={item.documentId}
                  hover
                  selected={item.documentId === selectedDocumentId}
                  onClick={() => setSelectedDocumentId(item.documentId)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.linkedTo}</TableCell>
                  <TableCell>{item.currentVersion?.version || item.version}</TableCell>
                  <TableCell>{item.currentVersion?.updatedAt || item.updatedAt}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to={item.bindingTargets[0]?.to || '/station/shipments'} size="small" variant="outlined">
                      关联对象
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 5 }}>
        <MainCard title="当前选中文件">
          <Stack sx={{ gap: 1.5 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'center' }}>
              <Box>
                <Typography variant="subtitle2">{selectedDocument.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedDocument.type} · 当前版本 {activeVersion?.version || selectedDocument.version} · {selectedDocument.previewType?.toUpperCase()}
                </Typography>
              </Box>
              <StatusChip label={selectedDocument.status} />
            </Stack>

            <Typography variant="body2" color="text.secondary">
              下一节点：{selectedDocument.nextStep}
            </Typography>

            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" onClick={() => handlePreview()}>
                预览
              </Button>
              <Button variant="outlined" onClick={handleReplace}>
                替换版本
              </Button>
              <Button variant="outlined" onClick={handleRollback}>
                回退版本
              </Button>
            </Stack>

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                版本侧栏
              </Typography>
              <List disablePadding>
                {selectedVersions.map((item) => (
                  <ListItemButton key={item.versionId} selected={item.versionId === activeVersion?.versionId} onClick={() => handlePreview(item.versionId)}>
                    <ListItemText
                      primary={`${item.version} · ${item.status}`}
                      secondary={`${item.updatedAt} · ${item.diffSummary}`}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                对象绑定
              </Typography>
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                {selectedDocument.bindingTargets.map((item) => (
                  <Button key={item.label} component={RouterLink} to={item.to} size="small" variant="outlined">
                    {item.label}
                  </Button>
                ))}
              </Stack>
            </Box>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 7 }}>
        <DocumentStatusCard title="选中文件命中的放行门槛" items={selectedGateItems} />
      </Grid>

      <Grid size={{ xs: 12, xl: 5 }}>
        <TaskQueueCard title="文件动作记录" items={activityLog} emptyText="当前还没有文件动作。" />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <MainCard title="指令模板">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>模板</TableCell>
                <TableCell>节点</TableCell>
                <TableCell>触发条件</TableCell>
                <TableCell align="right">跳转</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {instructionTemplateRows.map((item) => (
                <TableRow key={item.code} hover>
                  <TableCell>{item.title}</TableCell>
                  <TableCell>{item.linkedNode}</TableCell>
                  <TableCell>{item.trigger}</TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to="/station/tasks" size="small" variant="outlined">
                      任务池
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 8 }}>
        <MainCard title="当前生效版本说明">
          <Stack sx={{ gap: 1 }}>
            <Typography variant="subtitle2">{activeVersion?.version || selectedDocument.version}</Typography>
            <Typography variant="body2" color="text.secondary">
              {activeVersion?.previewSummary}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              差异摘要：{activeVersion?.diffSummary}
            </Typography>
          </Stack>
        </MainCard>
      </Grid>

      <Dialog open={previewOpen} onClose={() => setPreviewVersionId('')} fullWidth maxWidth="md">
        <DialogTitle>
          预览文件 / {selectedDocument.name} / {previewVersion?.version}
        </DialogTitle>
        <DialogContent dividers>
          <Stack sx={{ gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              预览类型：{previewVersion?.previewType?.toUpperCase()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {previewVersion?.previewSummary}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              版本差异：{previewVersion?.diffSummary}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              这是当前阶段的前端 demo 预览态，不连接真实文件存储。
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewVersionId('')}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
