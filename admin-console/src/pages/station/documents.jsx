import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import { openSnackbar } from 'api/snackbar';
import {
  archiveStationDocument,
  createStationDocument,
  createStationUploadTicket,
  downloadStationDocument,
  getDocumentPreviewUrl,
  getStationDocumentPreview,
  updateStationDocument,
  uploadStationFileByTicket,
  useGetStationDocumentDetail,
  useGetStationDocumentOptions,
  useGetStationDocuments
} from 'api/station';

const PAGE_SIZE = 20;
const DEFAULT_RELATED_OBJECT_TYPE = 'AWB';

const EMPTY_CREATE_FORM = {
  documentType: '',
  documentName: '',
  relatedObjectType: DEFAULT_RELATED_OBJECT_TYPE,
  relatedObjectId: '',
  retentionClass: 'operational',
  requiredForRelease: false,
  note: '',
  storageKey: ''
};

function buildEditForm(detail) {
  if (!detail?.documentId) {
    return {
      documentType: '',
      documentName: '',
      relatedObjectType: DEFAULT_RELATED_OBJECT_TYPE,
      relatedObjectId: '',
      retentionClass: 'operational',
      requiredForRelease: false,
      documentStatus: 'Uploaded',
      note: '',
      archived: false
    };
  }

  return {
    documentType: detail.type || '',
    documentName: detail.name || '',
    relatedObjectType: detail.relatedObjectType || DEFAULT_RELATED_OBJECT_TYPE,
    relatedObjectId: detail.relatedObjectId || '',
    retentionClass: detail.retentionClass || 'operational',
    requiredForRelease: Boolean(detail.requiredForRelease),
    documentStatus: detail.status || 'Uploaded',
    note: detail.note || '',
    archived: Boolean(detail.archived)
  };
}

export default function StationDocumentsPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState('');
  const [documentStatusFilter, setDocumentStatusFilter] = useState('');
  const [relatedObjectTypeFilter, setRelatedObjectTypeFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPayload, setPreviewPayload] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createFile, setCreateFile] = useState(null);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState(() => buildEditForm(null));

  const query = {
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    document_type: documentTypeFilter,
    document_status: documentStatusFilter,
    related_object_type: relatedObjectTypeFilter,
    include_archived: includeArchived
  };

  const { stationDocuments, stationDocumentsPage, stationDocumentsLoading, stationDocumentsError } = useGetStationDocuments(query);
  const {
    documentTypeOptions,
    documentStatusOptions,
    retentionClassOptions,
    relatedObjectTypeOptions,
    relatedObjectOptions,
    stationDocumentOptionsLoading
  } = useGetStationDocumentOptions({
    related_object_type: createOpen
      ? createForm.relatedObjectType
      : editOpen
        ? editForm.relatedObjectType
        : relatedObjectTypeFilter || DEFAULT_RELATED_OBJECT_TYPE
  });
  const { stationDocumentDetail, stationDocumentDetailLoading, stationDocumentDetailError } = useGetStationDocumentDetail(
    selectedDocumentId || null
  );

  useEffect(() => {
    if (!stationDocuments.length) {
      setSelectedDocumentId('');
      return;
    }

    if (!selectedDocumentId || !stationDocuments.some((item) => item.documentId === selectedDocumentId)) {
      setSelectedDocumentId(stationDocuments[0].documentId);
    }
  }, [selectedDocumentId, stationDocuments]);

  useEffect(() => {
    if (!editOpen) return;
    setEditForm(buildEditForm(stationDocumentDetail));
  }, [editOpen, stationDocumentDetail]);

  const metrics = useMemo(
    () => [
      {
        title: m('文档总数'),
        value: `${stationDocumentsPage.total || 0}`,
        helper: m('数据库分页台账'),
        chip: m('单证'),
        color: 'primary'
      },
      {
        title: m('当前页待处理'),
        value: `${stationDocuments.filter((item) => !['Approved', 'Released', 'Validated'].includes(item.status)).length}`,
        helper: m('需继续校验或放行'),
        chip: m('待处理'),
        color: 'warning'
      },
      {
        title: m('当前页已归档'),
        value: `${stationDocuments.filter((item) => item.archived).length}`,
        helper: m('软删除 / 归档状态'),
        chip: m('已归档'),
        color: 'secondary'
      },
      {
        title: m('需放行文件'),
        value: `${stationDocuments.filter((item) => item.requiredForRelease).length}`,
        helper: m('放行前必须满足'),
        chip: m('放行'),
        color: 'success'
      }
    ],
    [stationDocuments, stationDocumentsPage.total]
  );

  const openCreateDialog = () => {
    setCreateForm({
      ...EMPTY_CREATE_FORM,
      documentType: documentTypeOptions[0]?.value || '',
      retentionClass: retentionClassOptions[0]?.value || 'operational',
      relatedObjectType: relatedObjectTypeOptions[0]?.value || DEFAULT_RELATED_OBJECT_TYPE,
      relatedObjectId: relatedObjectOptions[0]?.value || ''
    });
    setCreateFile(null);
    setCreateOpen(true);
  };

  const openEditDialog = () => {
    setEditForm(buildEditForm(stationDocumentDetail));
    setEditOpen(true);
  };

  async function handlePreview() {
    if (!selectedDocumentId) return;
    setPreviewLoading(true);
    try {
      const response = await getStationDocumentPreview(selectedDocumentId);
      setPreviewPayload(response?.data || null);
    } catch {
      setPreviewPayload(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleCreateDocument() {
    try {
      setCreateLoading(true);
      let storageKey = createForm.storageKey;
      let documentName = createForm.documentName;
      let uploadId;

      if (createFile) {
        const ticket = await createStationUploadTicket({
          related_object_type: createForm.relatedObjectType,
          document_name: createFile.name,
          content_type: createFile.type || 'application/octet-stream',
          size_bytes: createFile.size,
          retention_class: createForm.retentionClass
        });

        await uploadStationFileByTicket(ticket, createFile);
        storageKey = ticket?.data?.storage_key || storageKey;
        documentName = ticket?.data?.document_name || createFile.name;
        uploadId = ticket?.data?.upload_id;
      }

      const response = await createStationDocument({
        document_type: createForm.documentType,
        document_name: documentName,
        related_object_type: createForm.relatedObjectType,
        related_object_id: createForm.relatedObjectId,
        storage_key: storageKey,
        upload_id: uploadId,
        content_type: createFile?.type,
        size_bytes: createFile?.size,
        required_for_release: createForm.requiredForRelease,
        retention_class: createForm.retentionClass,
        note: createForm.note || undefined,
        version_mode: 'new',
        trigger_parse: true
      });

      setCreateOpen(false);
      setSelectedDocumentId(response?.data?.document_id || '');
      openSnackbar({
        open: true,
        message: localizeUiText(locale, `${createForm.documentType} 已登记。`),
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || m('登记文档失败'),
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleSaveEdit() {
    if (!selectedDocumentId) return;

    try {
      setEditLoading(true);
      await updateStationDocument(selectedDocumentId, {
        document_type: editForm.documentType,
        document_name: editForm.documentName,
        related_object_type: editForm.relatedObjectType,
        related_object_id: editForm.relatedObjectId,
        retention_class: editForm.retentionClass,
        required_for_release: editForm.requiredForRelease,
        document_status: editForm.documentStatus,
        note: editForm.note,
        archived: editForm.archived
      });
      setEditOpen(false);
      openSnackbar({
        open: true,
        message: localizeUiText(locale, `${selectedDocumentId} 已更新。`),
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || m('更新文档失败'),
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setEditLoading(false);
    }
  }

  async function handleArchiveToggle(archived) {
    if (!selectedDocumentId) return;

    try {
      if (archived) {
        await updateStationDocument(selectedDocumentId, { archived: false });
        openSnackbar({
          open: true,
          message: localizeUiText(locale, `${selectedDocumentId} 已恢复。`),
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        await archiveStationDocument(selectedDocumentId);
        openSnackbar({
          open: true,
          message: localizeUiText(locale, `${selectedDocumentId} 已归档。`),
          variant: 'alert',
          alert: { color: 'success' }
        });
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || m('文档归档状态更新失败'),
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  }

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('单证台账')}
          title={m('单证中心')}
          description={m(
            'Documents 已收口为正式数据库资源：列表、详情、更新、归档/恢复、预览、下载都走统一对象链，前端不再依赖 demo 概览真相。'
          )}
          chips={['DB CRUD', '20 Per Page', 'Soft Delete', 'Presign Upload', m('Object Binding Options')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/documents/noa" variant="outlined">
                NOA
              </Button>
              <Button component={RouterLink} to="/station/documents/pod" variant="outlined">
                POD
              </Button>
              <Button variant="contained" onClick={openCreateDialog}>
                {m('登记文档')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      {metrics.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            {...item}
            title={item.title}
            helper={item.helper}
            chip={item.chip}
          />
        </Grid>
      ))}

      <Grid size={12}>
        <MainCard title={m('文档台账')} subheader={m('默认每页 20 条；筛选变更自动回第一页。')}>
          <Stack sx={{ gap: 2 }}>
            {stationDocumentsError ? (
              <Alert severity="error">{stationDocumentsError?.response?.data?.error?.message || m('文档台账读取失败。')}</Alert>
            ) : null}

            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                label={m('关键词')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 220 }}
                placeholder={m('文件名 / 文档编号 / 关联对象')}
              />
              <TextField
                select
                label={m('文档类型')}
                value={documentTypeFilter}
                onChange={(event) => {
                  setDocumentTypeFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
                disabled={stationDocumentOptionsLoading}
              >
                <MenuItem value="">{m('全部类型')}</MenuItem>
                {documentTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('状态')}
                value={documentStatusFilter}
                onChange={(event) => {
                  setDocumentStatusFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
                disabled={stationDocumentOptionsLoading}
              >
                <MenuItem value="">{m('全部状态')}</MenuItem>
                {documentStatusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('关联对象类型')}
                value={relatedObjectTypeFilter}
                onChange={(event) => {
                  setRelatedObjectTypeFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
                disabled={stationDocumentOptionsLoading}
              >
                <MenuItem value="">{m('全部对象')}</MenuItem>
                {relatedObjectTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <FormControlLabel
              control={
                <Switch
                  checked={includeArchived}
                  onChange={(event) => {
                    setIncludeArchived(event.target.checked);
                    setPage(0);
                  }}
                />
              }
              label={m('显示已归档')}
            />

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('编号')}</TableCell>
                  <TableCell>{m('类型')}</TableCell>
                  <TableCell>{m('文件名')}</TableCell>
                  <TableCell>{m('关联对象')}</TableCell>
                  <TableCell>{m('版本')}</TableCell>
                  <TableCell>{m('状态')}</TableCell>
                  <TableCell>{m('保留策略')}</TableCell>
                  <TableCell align="right">{m('操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stationDocuments.map((item) => (
                  <TableRow
                    key={item.documentId}
                    hover
                    selected={item.documentId === selectedDocumentId}
                    onClick={() => setSelectedDocumentId(item.documentId)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{item.documentId}</TableCell>
                    <TableCell>{localizeUiText(locale, item.type)}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{localizeUiText(locale, item.linkedTo)}</TableCell>
                    <TableCell>{item.version}</TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, item.status)} />
                    </TableCell>
                    <TableCell>{localizeUiText(locale, item.retentionClass)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                        {item.bindingTargets?.[0] ? (
                          <Button component={RouterLink} to={item.bindingTargets[0].to} size="small" variant="outlined">
                            {m('对象')}
                          </Button>
                        ) : null}
                        <Button
                          size="small"
                          variant="contained"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedDocumentId(item.documentId);
                            setTimeout(openEditDialog, 0);
                          }}
                        >
                          {m('编辑')}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <TablePagination
              component="div"
              count={stationDocumentsPage.total || 0}
              page={page}
              onPageChange={(_event, nextPage) => setPage(nextPage)}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
            />

            {stationDocumentsLoading ? <Alert severity="info">{m('文档台账正在从数据库读取，请稍候。')}</Alert> : null}
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title={m('当前文档详情')}>
          <Stack sx={{ gap: 1.5 }}>
            {stationDocumentDetailError ? (
              <Alert severity="error">{stationDocumentDetailError?.response?.data?.error?.message || m('文档详情读取失败。')}</Alert>
            ) : null}

            {!stationDocumentDetail?.documentId && !stationDocumentDetailLoading ? (
              <Alert severity="info">{m('当前页没有可查看的文档。')}</Alert>
            ) : null}

            {stationDocumentDetail?.documentId ? (
              <>
                <Stack direction={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle1">{stationDocumentDetail.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {localizeUiText(locale, stationDocumentDetail.type)} · {localizeUiText(locale, stationDocumentDetail.linkedTo)} ·{' '}
                      {stationDocumentDetail.version}
                    </Typography>
                  </Box>
                  <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                    <StatusChip label={localizeUiText(locale, stationDocumentDetail.status)} />
                    {stationDocumentDetail.archived ? <StatusChip label={m('已归档')} color="warning" /> : null}
                  </Stack>
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  {m('保留策略：')}
                  {localizeUiText(locale, stationDocumentDetail.retentionClass)} · {m('放行要求：')}
                  {stationDocumentDetail.requiredForRelease ? m('是') : m('否')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {m('备注：')}
                  {stationDocumentDetail.note || m('无')}
                </Typography>

                <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                  <Button variant="contained" onClick={handlePreview} disabled={previewLoading}>
                    {previewLoading ? m('预览加载中…') : m('预览')}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => downloadStationDocument(stationDocumentDetail.documentId, stationDocumentDetail.name)}
                  >
                    {m('下载')}
                  </Button>
                  <Button variant="outlined" onClick={openEditDialog}>
                    {m('编辑元数据')}
                  </Button>
                  <Button
                    variant="outlined"
                    color={stationDocumentDetail.archived ? 'success' : 'warning'}
                    onClick={() => handleArchiveToggle(stationDocumentDetail.archived)}
                  >
                    {stationDocumentDetail.archived ? m('恢复') : m('归档')}
                  </Button>
                </Stack>

                {previewPayload?.inline_supported ? (
                  <Alert
                    severity="info"
                    action={
                      <Button size="small" href={getDocumentPreviewUrl(stationDocumentDetail.documentId)} target="_blank">
                        {m('新窗口打开')}
                      </Button>
                    }
                  >
                    {m('已启用真实预览：')}
                    {localizeUiText(locale, previewPayload?.preview_type || stationDocumentDetail.previewType)}
                  </Alert>
                ) : null}
                {previewPayload && !previewPayload?.inline_supported ? (
                  <Alert severity="warning">{m('当前文件类型不支持 inline，已回退到下载或元数据预览。')}</Alert>
                ) : null}

                {previewPayload?.inline_supported ? (
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', minHeight: 420 }}>
                    <iframe
                      title={`preview-${stationDocumentDetail.documentId}`}
                      src={getDocumentPreviewUrl(stationDocumentDetail.documentId)}
                      style={{ width: '100%', minHeight: 420, border: 0 }}
                    />
                  </Box>
                ) : null}

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {m('版本链')}
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{m('版本')}</TableCell>
                        <TableCell>{m('状态')}</TableCell>
                        <TableCell>{m('更新时间')}</TableCell>
                        <TableCell>{m('说明')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(stationDocumentDetail.versions || []).map((item) => (
                        <TableRow key={item.versionId || item.document_id}>
                          <TableCell>{item.version}</TableCell>
                          <TableCell>
                            <StatusChip label={localizeUiText(locale, item.status)} />
                          </TableCell>
                          <TableCell>{item.updatedAt}</TableCell>
                          <TableCell>{localizeUiText(locale, item.previewSummary)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </>
            ) : null}
          </Stack>
        </MainCard>
      </Grid>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{m('登记文档')}</DialogTitle>
        <DialogContent dividers>
          <Stack sx={{ gap: 1.5, pt: 0.5 }}>
            <TextField
              select
              label={m('文件类型')}
              value={createForm.documentType}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, documentType: event.target.value }))}
            >
              {documentTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={m('文件名')}
              value={createForm.documentName}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, documentName: event.target.value }))}
            />
            <TextField
              select
              label={m('关联对象类型')}
              value={createForm.relatedObjectType}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  relatedObjectType: event.target.value,
                  relatedObjectId: ''
                }))
              }
            >
              {relatedObjectTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={m('绑定对象')}
              value={createForm.relatedObjectId}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, relatedObjectId: event.target.value }))}
            >
              {relatedObjectOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={m('保留策略')}
              value={createForm.retentionClass}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, retentionClass: event.target.value }))}
            >
              {retentionClassOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Switch
                  checked={createForm.requiredForRelease}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, requiredForRelease: event.target.checked }))}
                />
              }
              label={m('放行前必须')}
            />
            <TextField
              label={m('备注')}
              value={createForm.note}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, note: event.target.value }))}
              multiline
              minRows={2}
            />
            <TextField
              label={m('Storage Key（无文件上传时使用）')}
              value={createForm.storageKey}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, storageKey: event.target.value }))}
            />
            <Button variant="outlined" component="label">
              {createFile ? `${m('已选择文件：')}${createFile.name}` : m('选择文件并上传到 R2')}
              <input
                hidden
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setCreateFile(file);
                  if (file) {
                    setCreateForm((prev) => ({ ...prev, documentName: file.name }));
                  }
                }}
              />
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={createLoading}>
            {m('取消')}
          </Button>
          <Button onClick={handleCreateDocument} variant="contained" disabled={createLoading}>
            {createLoading ? m('提交中…') : m('提交')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{m('编辑文档元数据')}</DialogTitle>
        <DialogContent dividers>
          <Stack sx={{ gap: 1.5, pt: 0.5 }}>
            <TextField
              select
              label={m('文件类型')}
              value={editForm.documentType}
              onChange={(event) => setEditForm((prev) => ({ ...prev, documentType: event.target.value }))}
            >
              {documentTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={m('文件名')}
              value={editForm.documentName}
              onChange={(event) => setEditForm((prev) => ({ ...prev, documentName: event.target.value }))}
            />
            <TextField
              select
              label={m('关联对象类型')}
              value={editForm.relatedObjectType}
              onChange={(event) =>
                setEditForm((prev) => ({
                  ...prev,
                  relatedObjectType: event.target.value,
                  relatedObjectId: ''
                }))
              }
            >
              {relatedObjectTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={m('绑定对象')}
              value={editForm.relatedObjectId}
              onChange={(event) => setEditForm((prev) => ({ ...prev, relatedObjectId: event.target.value }))}
            >
              {relatedObjectOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={m('文档状态')}
              value={editForm.documentStatus}
              onChange={(event) => setEditForm((prev) => ({ ...prev, documentStatus: event.target.value }))}
            >
              {documentStatusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={m('保留策略')}
              value={editForm.retentionClass}
              onChange={(event) => setEditForm((prev) => ({ ...prev, retentionClass: event.target.value }))}
            >
              {retentionClassOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {localizeUiText(locale, option.label)}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Switch
                  checked={editForm.requiredForRelease}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, requiredForRelease: event.target.checked }))}
                />
              }
              label={m('放行前必须')}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={editForm.archived}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, archived: event.target.checked }))}
                />
              }
              label={m('归档')}
            />
            <TextField
              label={m('备注')}
              value={editForm.note}
              onChange={(event) => setEditForm((prev) => ({ ...prev, note: event.target.value }))}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={editLoading}>
            {m('取消')}
          </Button>
          <Button onClick={handleSaveEdit} variant="contained" disabled={editLoading}>
            {editLoading ? m('保存中…') : m('保存')}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
