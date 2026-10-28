import React, { useEffect } from 'react';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm, isNumber } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './record-revision.reducer';

export const RecordRevisionUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const recordRevisionEntity = useAppSelector(state => state.recordRevision.entity);
  const loading = useAppSelector(state => state.recordRevision.loading);
  const updating = useAppSelector(state => state.recordRevision.updating);
  const updateSuccess = useAppSelector(state => state.recordRevision.updateSuccess);

  const handleClose = () => {
    navigate('/record-revision');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }
  }, []);

  useEffect(() => {
    if (updateSuccess) {
      handleClose();
    }
  }, [updateSuccess]);

  const saveEntity = values => {
    if (values.id !== undefined && typeof values.id !== 'number') {
      values.id = Number(values.id);
    }
    if (values.sourceId !== undefined && typeof values.sourceId !== 'number') {
      values.sourceId = Number(values.sourceId);
    }
    values.changedAt = convertDateTimeToServer(values.changedAt);

    const entity = {
      ...recordRevisionEntity,
      ...values,
    };

    if (isNew) {
      dispatch(createEntity(entity));
    } else {
      dispatch(updateEntity(entity));
    }
  };

  const defaultValues = () =>
    isNew
      ? {
          changedAt: displayDefaultDateTime(),
        }
      : {
          ...recordRevisionEntity,
          changedAt: convertDateTimeFromServer(recordRevisionEntity.changedAt),
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.recordRevision.home.createOrEditLabel" data-cy="RecordRevisionCreateUpdateHeading">
            Thêm mới hoặc cập nhật Record Revision
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="record-revision-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Source Type"
                id="record-revision-sourceType"
                name="sourceType"
                data-cy="sourceType"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 50, message: 'Trường này không được vượt quá 50 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ERD: source_type + source_id - tách 2 cột</Tooltip>}>
                <span id="sourceTypeLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="Source Id"
                id="record-revision-sourceId"
                name="sourceId"
                data-cy="sourceId"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <ValidatedField
                label="Action"
                id="record-revision-action"
                name="action"
                data-cy="action"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>CORRECT | VOID</Tooltip>}>
                <span id="actionLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField label="Reason" id="record-revision-reason" name="reason" data-cy="reason" type="textarea" />
              <ValidatedField
                label="Before Snapshot"
                id="record-revision-beforeSnapshot"
                name="beforeSnapshot"
                data-cy="beforeSnapshot"
                type="textarea"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ERD: before / after - tách 2 cột</Tooltip>}>
                <span id="beforeSnapshotLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField
                label="After Snapshot"
                id="record-revision-afterSnapshot"
                name="afterSnapshot"
                data-cy="afterSnapshot"
                type="textarea"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Changed At"
                id="record-revision-changedAt"
                name="changedAt"
                data-cy="changedAt"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ERD: time</Tooltip>}>
                <span id="changedAtLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/record-revision" replace variant="info">
                <FontAwesomeIcon icon="arrow-left" />
                &nbsp;
                <span className="d-none d-md-inline">Quay lại</span>
              </Button>
              &nbsp;
              <Button variant="primary" id="save-entity" data-cy="entityCreateSaveButton" type="submit" disabled={updating}>
                <FontAwesomeIcon icon="save" />
                &nbsp; Lưu
              </Button>
            </ValidatedForm>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default RecordRevisionUpdate;
