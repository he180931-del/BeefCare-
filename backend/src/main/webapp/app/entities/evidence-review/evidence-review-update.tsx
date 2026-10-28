import React, { useEffect } from 'react';
import { Button, Col, FormText, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getEntities as getAppUsers } from 'app/entities/app-user/app-user.reducer';
import { getEntities as getBankTransferEvidences } from 'app/entities/bank-transfer-evidence/bank-transfer-evidence.reducer';
import { convertDateTimeFromServer, convertDateTimeToServer, displayDefaultDateTime } from 'app/shared/util/date-utils';

import { createEntity, getEntity, reset, updateEntity } from './evidence-review.reducer';

export const EvidenceReviewUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { id } = useParams<'id'>();
  const isNew = id === undefined;

  const bankTransferEvidences = useAppSelector(state => state.bankTransferEvidence.entities);
  const appUsers = useAppSelector(state => state.appUser.entities);
  const evidenceReviewEntity = useAppSelector(state => state.evidenceReview.entity);
  const loading = useAppSelector(state => state.evidenceReview.loading);
  const updating = useAppSelector(state => state.evidenceReview.updating);
  const updateSuccess = useAppSelector(state => state.evidenceReview.updateSuccess);

  const handleClose = () => {
    navigate('/evidence-review');
  };

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getEntity(id));
    }

    dispatch(getBankTransferEvidences({}));
    dispatch(getAppUsers({}));
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
    values.reviewedAt = convertDateTimeToServer(values.reviewedAt);

    const entity = {
      ...evidenceReviewEntity,
      ...values,
      evidence: bankTransferEvidences.find(it => it.id.toString() === values.evidence?.toString()),
      pmUser: appUsers.find(it => it.id.toString() === values.pmUser?.toString()),
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
          reviewedAt: displayDefaultDateTime(),
        }
      : {
          ...evidenceReviewEntity,
          reviewedAt: convertDateTimeFromServer(evidenceReviewEntity.reviewedAt),
          evidence: evidenceReviewEntity?.evidence?.id,
          pmUser: evidenceReviewEntity?.pmUser?.id,
        };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="beefcareApp.evidenceReview.home.createOrEditLabel" data-cy="EvidenceReviewCreateUpdateHeading">
            Thêm mới hoặc cập nhật Evidence Review
          </h2>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm defaultValues={defaultValues()} onSubmit={saveEntity}>
              {!isNew && <ValidatedField name="id" required readOnly id="evidence-review-id" label="ID" validate={{ required: true }} />}
              <ValidatedField
                label="Decision"
                id="evidence-review-decision"
                name="decision"
                data-cy="decision"
                type="text"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                  maxLength: { value: 30, message: 'Trường này không được vượt quá 30 ký tự.' },
                }}
              />
              <ValidatedField label="Reason" id="evidence-review-reason" name="reason" data-cy="reason" type="textarea" />
              <ValidatedField
                label="Reviewed At"
                id="evidence-review-reviewedAt"
                name="reviewedAt"
                data-cy="reviewedAt"
                type="datetime-local"
                placeholder="YYYY-MM-DD HH:mm"
                validate={{
                  required: { value: true, message: 'Trường này bắt buộc phải nhập.' },
                }}
              />
              <OverlayTrigger overlay={<Tooltip>ERD: time</Tooltip>}>
                <span id="reviewedAtLabel" className="d-inline-block">
                  ?
                </span>
              </OverlayTrigger>
              <ValidatedField id="evidence-review-evidence" name="evidence" data-cy="evidence" label="Evidence" type="select" required>
                <option value="" key="0" />
                {bankTransferEvidences
                  ? bankTransferEvidences.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <ValidatedField id="evidence-review-pmUser" name="pmUser" data-cy="pmUser" label="Pm User" type="select" required>
                <option value="" key="0" />
                {appUsers
                  ? appUsers.map(otherEntity => (
                      <option value={otherEntity.id} key={otherEntity.id}>
                        {otherEntity.id}
                      </option>
                    ))
                  : null}
              </ValidatedField>
              <FormText>Trường này bắt buộc phải nhập.</FormText>
              <Button as={Link as any} id="cancel-save" data-cy="entityCreateCancelButton" to="/evidence-review" replace variant="info">
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

export default EvidenceReviewUpdate;
