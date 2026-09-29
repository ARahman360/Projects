package components;

public class Kin {
	public String firstName;
	public String surName;
	public String relation;
	public String mobile;
	public String email;
	public String address;
	
	public Kin(String firstName, String surName, String relation, String mobile, String email, String address) {
		this.firstName = firstName;
		this.surName = surName;
		this.relation = relation;
		this.mobile = mobile;
		this.email = email;
		this.address = address;
	}
	
	public boolean noError(){
		return !firstName.isEmpty() && !surName.isEmpty() && !relation.isEmpty() && !mobile.isEmpty() && !email.isEmpty() && !address.isEmpty(); 
    }
}
