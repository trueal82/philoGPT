import {
  List,
  Datagrid,
  TextField,
  BooleanField,
  EditButton,
  Create,
  Edit,
  SimpleForm,
  TextInput,
  BooleanInput,
} from 'react-admin';

export function UserGroupList() {
  return (
    <List sort={{ field: 'name', order: 'ASC' }}>
      <Datagrid rowClick="edit">
        <TextField source="name" />
        <TextField source="description" />
        <BooleanField source="active" />
        <EditButton />
      </Datagrid>
    </List>
  );
}

function UserGroupForm() {
  return (
    <>
      <TextInput source="name" fullWidth />
      <TextInput source="description" fullWidth multiline minRows={3} />
      <BooleanInput source="active" />
    </>
  );
}

export function UserGroupCreate() {
  return (
    <Create>
      <SimpleForm>
        <UserGroupForm />
      </SimpleForm>
    </Create>
  );
}

export function UserGroupEdit() {
  return (
    <Edit>
      <SimpleForm>
        <UserGroupForm />
      </SimpleForm>
    </Edit>
  );
}
