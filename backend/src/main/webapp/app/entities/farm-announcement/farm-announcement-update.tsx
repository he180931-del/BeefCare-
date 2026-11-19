import React, { useEffect } from 'react';
import { Button, Col, FormText, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getFarms } from 'app/entities/farm/farm.reducer';
import { getEntities as getFarmMemberships } from 'app/entities/farm-membership/farm-membership.reducer';

import { createEntity, getEntity, reset, updateEntity } from './farm-announcement.reducer';

export const FarmAnnouncementUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const farms = useAppSelector(state => state.farm.entities);
  const farmMemberships = useAppSelector(state => state.farmMembership.entities);
  const farmAnnouncementEntity = useAppSelector(state => state.farmAnnouncement.entity);
  const loading = useAppSelector(state => state.farmAnnouncement.loading);
  const updating = useAppSelector(state => state.farmAnnouncement.updating);
  const updateSuccess = useAppSelector(state => state.farmAnnouncement.updateSuccess);

  const handleClose = () => {
    navigate('/farm-announcement');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getFarms({}));
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

    const entity = {
      ...farmAnnouncementEntity,
      ...values,
      farm: farms.find(it => it.id.toString() === values.farm?.toString()),
      author: farmMemberships.find(it => it.id.toString() === values.author?.toString()),
    };

    if (isNew) {
      dispatch(createEntity(entity));
    } else {
      dispatch(updateEntity(entity));
    }
  };

  const defaultValues = () =>
    isNew
      ? {}
      : {
          ...farmAnnouncementEntity,
          farm: farmAnnouncementEntity?.farm?.id,
          author: farmAnnouncementEntity?.author?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.farmAnnouncement.home.createOrEditLabel" data-cy="FarmAnnouncementCreateUpdateHeading">
            Thêm mới hoặc cập nhật Farm Announcement
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="farm-announcement-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="State"
                id="farm-announcement-state"
                name="state"
                data-cy="state"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField id="farm-announcement-farm" name="farm" data-cy="farm" label="Farm" type="select" required>
                <option value="" key="0" />
                {farms
                  ? farms.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField id="farm-announcement-author" name="author" data-cy="author" label="Author" type="select" required>
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
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/farm-announcement" replace variant="info">
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

export default FarmAnnouncementUpdate;
