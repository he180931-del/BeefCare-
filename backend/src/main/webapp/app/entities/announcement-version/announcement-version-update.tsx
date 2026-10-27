import React, { useEffect } from 'react';
import { Button, Col, FormText, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm, isNumber } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getFarmAnnouncements } from 'app/entities/farm-announcement/farm-announcement.reducer';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './announcement-version.reducer';

export const AnnouncementVersionUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const farmAnnouncements = useAppSelector(state => state.farmAnnouncement.entities);
  const announcementVersionEntity = useAppSelector(state => state.announcementVersion.entity);
  const loading = useAppSelector(state => state.announcementVersion.loading);
  const updating = useAppSelector(state => state.announcementVersion.updating);
  const updateSuccess = useAppSelector(state => state.announcementVersion.updateSuccess);

  const handleClose = () => {
    navigate('/announcement-version');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getFarmAnnouncements({}));
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
    if (values.versionNo !== undefined && typeof values.versionNo !== 'number') {
      values.versionNo = Number(values.versionNo);
    }
    values.publishedTime = convertDateTimeToServer(values.publishedTime);

    const entity = {
      ...announcementVersionEntity,
      ...values,
      announcement: farmAnnouncements.find(it => it.id.toString() === values.announcement?.toString()),
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
          publishedTime: displayDefaultDateTime(),
        }
      : {
          ...announcementVersionEntity,
          publishedTime: convertDateTimeFromServer(announcementVersionEntity.publishedTime),
          announcement: announcementVersionEntity?.announcement?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.announcementVersion.home.createOrEditLabel" data-cy="AnnouncementVersionCreateUpdateHeading">
            Thêm mới hoặc cập nhật Announcement Version
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
                <ValidatedField name="id" required readOnly id="announcement-version-id" label="ID" validate={{ required: true }} />
              )}
              <ValidatedField
                label="Version No"
                id="announcement-version-versionNo"
                name="versionNo"
                data-cy="versionNo"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  validate: v => isNumber(v) || 'Trường này phải là một số.',
                }}
              />
              <ValidatedField
                label="Title"
                id="announcement-version-title"
                name="title"
                data-cy="title"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 255, message: 'Trường này không được vượt quá 255 ký tự.' },
                }}
              />
              <ValidatedField
                label="Body"
                id="announcement-version-body"
                name="body"
                data-cy="body"
                type="textarea"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                label="Published Time"
                id="announcement-version-publishedTime"
                name="publishedTime"
                data-cy="publishedTime"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <ValidatedField
                id="announcement-version-announcement"
                name="announcement"
                data-cy="announcement"
                label="Announcement"
                type="select"
                required
              >
                <option value="" key="0" />
                {farmAnnouncements
                  ? farmAnnouncements.map(otherEntity => (
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
                to="/announcement-version"
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

export default AnnouncementVersionUpdate;
