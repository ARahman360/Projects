package components;

public class CustomDate {
	public String dayString;
	public String monthString;
	public String yearString;
	
	public CustomDate(String dayString, String monthString, String yearString) {
		this.dayString = dayString;
		this.monthString = monthString;
		this.yearString = yearString;
	}
	
	public String getString(){
		return dayString +"-"+ monthString +"-"+ yearString;
    }
	
	public boolean isEmpty(){
		return dayString.isEmpty() && monthString.isEmpty() && yearString.isEmpty();
    }
	
	public boolean isParsable(){
		return isNumeric(dayString) && isNumeric(monthString) && isNumeric(yearString);
    }
	
	public static boolean isNumeric(String strNum) {
	    if (strNum == null) {
	        return false;
	    }
	    try {
	        double d = Double.parseDouble(strNum);
	    } catch (NumberFormatException nfe) {
	        return false;
	    }
	    return true;
	}
}