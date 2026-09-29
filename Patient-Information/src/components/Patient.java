package components;

public class Patient {
	public String firstName;
	public String surName;
	public String dob;
	public String mobile;
	public String email;
	public String address;
	
	public Patient(String firstName, String surName, String dob, String mobile, String email, String address) {
		this.firstName = firstName;
		this.surName = surName;
		this.dob = dob;
		this.mobile = mobile;
		this.email = email;
		this.address = address;
	}
	
	public boolean noError(){
		return !firstName.isEmpty() && !surName.isEmpty() && !dob.isEmpty() && !mobile.isEmpty() && !email.isEmpty() && !address.isEmpty();
    }
}