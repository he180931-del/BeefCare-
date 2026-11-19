import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getAnnouncementVersions } from 'app/entities/announcement-version/announcement-version.reducer';
import { getEntities as getFarmMemberships } from 'app/entities/farm-membership/farm-membership.reducer';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './announcement-recipient.reducer';

export const AnnouncementRecipientUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const announcementVersions = useAppSelector(state => state.announcementVersion.entities);
  const farmMemberships = useAppSelector(state => state.farmMembership.entities);
  const announcementRecipientEntity = useAppSelector(state => state.announcementRecipient.entity);
  const loading = useAppSelector(state => state.announcementRecipient.loading);
  const updating = useAppSelector(state => state.announcementRecipient.updating);
  const updateSuccess = useAppSelector(state => state.announcementRecipient.updateSuccess);

  const handleClose = () => {
    navigate('/announcement-recipient');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getAnnouncementVersions({}));
    dispatch(getFarmMemberships({}));
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
    values.deliveredTime = convertDateTimeToServer(values.deliveredTime);
    values.readTime = convertDateTimeToServer(values.readTime);

    const entity = {
      ...announcementRecipientEntity,
      ...values,
      version: announcementVersions.find(it => it.id.toString() === values.version?.toString()),
      membership: farmMemberships.find(it => it.id.toString() === values.membership?.toString()),
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
          deliveredTime: displayDefaultDateTime(),
          readTime: displayDefaultDateTime(),
        }
      : {
          ...announcementRecipientEntity,
          deliveredTime: convertDateTimeFromServer(announcementRecipientEntity.deliveredTime),
          readTime: convertDateTimeFromServer(announcementRecipientEntity.readTime),
          version: announcementRecipientEntity?.version?.id,
          membership: announcementRecipientEntity?.membership?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.announcementRecipient.home.createOrEditLabel" data-cy="AnnouncementRecipientCreateUpdateHeading">
            Thêm mới hoặc cập nhật Announcement Recipient
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && (
                <ValidatedField name="id" required readOnly id="announcement-recipient-id" label="ID" validate={{ required: true }} />
              )}
              <ValidatedField
                label="Delivered Time"
                id="announcement-recipient-deliveredTime"
                name="deliveredTime"
                data-cy="deliveredTime"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Read Time"
                id="announcement-recipient-readTime"
                name="readTime"
                data-cy="readTime"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
              />
              <OverlayTrigger overlay={<Tooltip>ERD: NOT NULL; để trống được vì chưa đọc thì chưa có thời điểm đọc</Tooltip>}>
                <span id="readTimeLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField id="announcement-recipient-version" name="version" data-cy="version" label="Version" type="select" required>
                <option value="" key="0" />
                {announcementVersions
                  ? announcementVersions.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField
                id="announcement-recipient-membership"
                name="membership"
                data-cy="membership"
                label="Membership"
                type="select"
                required
              >
                <option value="" key="0" />
                {farmMemberships
                  ? farmMemberships.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <Button
                as={Link as any}
                id="cancel-save"
                data-cy="entityCreateCancelButton"
                to="/announcement-recipient"
                replace
                variant="info"
              >
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

export default AnnouncementRecipientUpdate;
